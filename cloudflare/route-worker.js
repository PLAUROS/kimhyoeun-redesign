// 탑승 핀을 옮겼을 때 실제 도로 경로를 받아 주는 Cloudflare Worker예요.
// REST 키는 코드에 넣지 않고 Worker의 Secret(KAKAO_REST_KEY)에 넣어요. 응답에도 키는 담기지 않아요.
// GET /route?from=위도,경도&to=장소key (좌표는 소수 3자리)

const API = 'https://apis-navi.kakaomobility.com/v1/directions';
const ALLOWED_ORIGINS = new Set(['https://baepu-team.github.io', 'http://127.0.0.1:5500']); // 이 페이지들에서만 부를 수 있어요
const HOME = { lat: 37.256, lon: 127.0665 }; // 페이지의 ROUTES_ORIGIN과 같아요
const MAX_FROM_KM = 30; // 현재 위치나 검색한 장소에서 출발할 수 있게 넓혔어요. 도착지가 영통 일대라 이보다 먼 출발지는 어림값으로 보여 줘요
// 페이지의 PLACES와 같은 도착지만 받아요. 이 서버로 다른 경로를 받아 가지 못하게 하려는 거예요
const PLACES = {
  ajou: [37.2797, 127.0473], ytst: [37.251528, 127.071347], mpst: [37.245799, 127.057364], cmst: [37.259485, 127.078945],
  mtst: [37.253019, 127.040389], gjst: [37.2886, 127.0514], lake: [37.281433, 127.069243], cafe: [37.2528, 127.069],
  sdc: [37.2575, 127.051], khu: [37.2398, 127.0832],
};
const TOLERANCE_M = 6; // tools/fetch_routes.py와 같은 값이에요
const CACHE_SECONDS = 604800; // 같은 요청은 일주일 동안 저장해 둔 값을 줘요
const WINDOW_MS = 60000;
const LIMIT_PER_IP = 20; // 한 사람은 1분에 20번까지
const LIMIT_TOTAL = 240; // 서버 인스턴스 하나당 1분에 240번까지

// 요청 수는 서버 인스턴스별로 세요. 정확한 제한은 아니고, 좌표·도착지 제한과 저장을 돕는 안전장치예요
const hits = new Map();
let total = { start: 0, count: 0 };
function limited(ip, now) {
  if (now - total.start >= WINDOW_MS) total = { start: now, count: 0 };
  if (++total.count > LIMIT_TOTAL) return true;
  if (hits.size > 2000) for (const [k, v] of hits) if (now - v.start >= WINDOW_MS) hits.delete(k);
  let h = hits.get(ip);
  if (!h || now - h.start >= WINDOW_MS) { h = { start: now, count: 0 }; hits.set(ip, h); }
  return ++h.count > LIMIT_PER_IP;
}

function km(a, b) {
  const t = Math.PI / 180, dLa = (b.lat - a.lat) * t, dLo = (b.lon - a.lon) * t;
  const h = Math.sin(dLa / 2) ** 2 + Math.cos(a.lat * t) * Math.cos(b.lat * t) * Math.sin(dLo / 2) ** 2;
  return 2 * 6371 * Math.asin(Math.sqrt(h));
}

function parseFrom(v) {
  // 소수 3자리로 고정해요. 같은 자리가 여러 표기로 저장되지 않게 하려는 거예요
  const m = /^(\d{2}\.\d{3}),(\d{3}\.\d{3})$/.exec(v || '');
  if (!m) return null;
  const p = { lat: +m[1], lon: +m[2] };
  if (p.lat > 90 || p.lon > 180) return null;
  return km(p, HOME) <= MAX_FROM_KM ? p : null;
}

function parseTo(v) {
  if (!Object.prototype.hasOwnProperty.call(PLACES, v)) return null;
  const [lat, lon] = PLACES[v];
  return { lat, lon };
}

// Douglas-Peucker. 좌표는 [위도, 경도]
function simplify(points, tol = TOLERANCE_M) {
  if (points.length < 3) return points;
  const cos0 = Math.cos((points[0][0] * Math.PI) / 180);
  const xy = (p) => [p[1] * 111320 * cos0, p[0] * 110540];
  const keep = new Array(points.length).fill(false);
  keep[0] = keep[points.length - 1] = true;
  const stack = [[0, points.length - 1]];
  while (stack.length) {
    const [a, b] = stack.pop();
    if (b <= a + 1) continue;
    const [ax, ay] = xy(points[a]);
    const [bx, by] = xy(points[b]);
    const dx = bx - ax, dy = by - ay, len2 = dx * dx + dy * dy;
    let worst = -1, at = -1;
    for (let i = a + 1; i < b; i++) {
      const [px, py] = xy(points[i]);
      const t = len2 ? Math.max(0, Math.min(1, ((px - ax) * dx + (py - ay) * dy) / len2)) : 0;
      const d = Math.hypot(px - (ax + t * dx), py - (ay + t * dy));
      if (d > worst) { worst = d; at = i; }
    }
    if (worst > tol) {
      keep[at] = true;
      stack.push([a, at], [at, b]);
    }
  }
  return points.filter((_, i) => keep[i]);
}

function extract(body) {
  const route = body && body.routes && body.routes[0];
  if (!route || route.result_code !== 0) return null;
  const points = [];
  for (const section of route.sections || []) {
    for (const road of section.roads || []) {
      const v = road.vertexes || [];
      for (let i = 0; i + 1 < v.length; i += 2) {
        if (!Number.isFinite(v[i]) || !Number.isFinite(v[i + 1])) return null;
        const p = [+v[i + 1].toFixed(6), +v[i].toFixed(6)]; // vertexes는 경도, 위도 순서예요
        const last = points[points.length - 1];
        if (!last || last[0] !== p[0] || last[1] !== p[1]) points.push(p);
      }
    }
  }
  const s = route.summary || {}, fare = s.fare || {};
  if (points.length < 2 || !(s.distance > 0) || !(s.duration > 0) || !(fare.taxi > 0)) return null;
  return { path: simplify(points), m: s.distance, s: s.duration, taxi: fare.taxi };
}

function reply(status, body, origin, extra = {}) {
  const headers = { 'content-type': 'application/json; charset=utf-8', 'x-content-type-options': 'nosniff', vary: 'Origin', ...extra };
  if (origin) headers['access-control-allow-origin'] = origin;
  return new Response(typeof body === 'string' ? body : JSON.stringify(body), { status, headers });
}

export default {
  async fetch(req, env, ctx) {
    const origin = req.headers.get('origin');
    const allowed = ALLOWED_ORIGINS.has(origin) ? origin : null;
    if (!allowed) return reply(403, { error: 'origin' }); // 브라우저가 아닌 호출까지 막지는 못해서 지역 제한과 함께 써요
    if (req.method !== 'GET') return reply(405, { error: 'method' }, allowed);

    const url = new URL(req.url);
    if (url.pathname !== '/route') return reply(404, { error: 'path' }, allowed);
    // from과 to만 한 번씩 받아요. 다른 값을 붙여 저장을 비켜 가지 못하게 하려는 거예요
    const keys = [...url.searchParams.keys()].sort().join();
    if (keys !== 'from,to') return reply(400, { error: 'point' }, allowed);
    const from = url.searchParams.get('from'), to = url.searchParams.get('to');
    const a = parseFrom(from), b = parseTo(to);
    if (!a || !b) return reply(400, { error: 'point' }, allowed);

    if (limited(req.headers.get('cf-connecting-ip') || 'unknown', Date.now())) return reply(429, { error: 'rate' }, allowed, { 'retry-after': '60' });

    const cacheKey = new Request(`${url.origin}/route?from=${from}&to=${to}`);
    const hit = await caches.default.match(cacheKey);
    if (hit) return reply(200, await hit.text(), allowed, { 'cache-control': 'public, max-age=86400', 'x-route-cache': 'hit', 'access-control-expose-headers': 'x-route-cache' });

    const key = env.KAKAO_REST_KEY;
    if (!key) return reply(503, { error: 'key' }, allowed);

    const query = new URLSearchParams({ origin: `${a.lon},${a.lat}`, destination: `${b.lon},${b.lat}` });
    let res;
    try {
      res = await fetch(`${API}?${query}`, { headers: { Authorization: `KakaoAK ${key}` }, signal: AbortSignal.timeout(4000) });
    } catch {
      return reply(502, { error: 'upstream' }, allowed);
    }
    if (!res.ok) return reply(502, { error: 'upstream', status: res.status }, allowed); // 카카오 응답 본문은 그대로 넘기지 않아요
    const route = extract(await res.json().catch(() => null));
    if (!route) return reply(502, { error: 'route' }, allowed);

    const text = JSON.stringify(route);
    ctx.waitUntil(caches.default.put(cacheKey, new Response(text, { headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': `public, max-age=${CACHE_SECONDS}` } })));
    return reply(200, text, allowed, { 'cache-control': 'public, max-age=86400', 'x-route-cache': 'miss', 'access-control-expose-headers': 'x-route-cache' });
  },
};
