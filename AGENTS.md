# 배프 택시 연습 시안: 작업 안내

이 저장소에서 작업하는 사람과 AI가 먼저 읽는 문서예요. 어르신이 택시 부르기를 연습하는 페이지의 시안이고, **실제로 호출되거나 결제되지 않아요.**

공개 주소: https://baepu-team.github.io/kimhyoeun-redesign/

## 1. 구성 한눈에 보기

| 역할 | 위치 | 소유 | 비고 |
|---|---|---|---|
| 코드 저장, 페이지 공개 | GitHub `baepu-team/kimhyoeun-redesign`, GitHub Pages | 조직 `baepu-team` (Owner: `PLAUROS`, `he040826-dotcom`) | `main` 브랜치 루트가 그대로 공개돼요 |
| 지도 표시 | 카카오맵 JavaScript SDK | 카카오 개발자 앱 `배프` (`PLAUROS` 쪽 사용자 소유) | JavaScript 키는 `index.html`에 있어요 |
| 실제 경로·요금 | Cloudflare Worker `baepu-route` | `PLAUROS` 쪽 사용자의 Cloudflare 계정 | REST 키는 Worker Secret `KAKAO_REST_KEY`에만 있어요 |

동작 순서:

1. 페이지는 GitHub Pages에서 열리고, 카카오에서 지도를 직접 불러와요.
2. 도착지 10곳의 경로와 요금은 `ROUTES`에 미리 들어 있어요. 탑승 핀이 기본 위치에서 150m 안이면 이 값을 써요.
3. 핀을 150m 넘게 옮기면 페이지가 `CONFIG.ROUTE_API`(Worker)에 요청하고, Worker가 카카오 길찾기를 대신 호출해요.
4. Worker를 못 쓰면 곡선과 어림 요금으로 그대로 진행돼요. 카카오맵을 못 불러오면 그림 지도(SVG)로 바뀌어요.

## 2. 파일 역할

| 파일 | 역할 | 고칠 때 주의할 점 |
|---|---|---|
| `index.html` | 화면, 흐름, 채점, 지도, 데이터가 모두 들어 있는 파일 하나예요. 빌드 과정이 없어요 | `main`에 저장하면 바로 공개돼요 |
| `cloudflare/route-worker.js` | 핀을 옮겼을 때 실제 경로와 요금을 받아 주는 서버 코드예요 | **저장소를 고쳐도 자동 반영되지 않아요.** Cloudflare의 `baepu-route` 편집 화면에 같은 코드를 넣고 Deploy해야 해요 |
| `README.md` | 저장소 소개예요 | |
| `AGENTS.md` | 이 문서예요 | 구조나 소유자가 바뀌면 함께 고쳐요 |

브랜치 `with-3d-intro`에는 3D 도시 시작 화면이 있던 이전 버전이 보존되어 있어요. 이 브랜치는 공개 주소로 나가지 않아요. 지울 필요가 없고, `main`에 합치면 3D 화면이 돌아와요.

### `index.html` 안에서 찾을 곳

| 이름 | 내용 |
|---|---|
| `CONFIG` | `KAKAO_JS_KEY`, `KAKAO_TIMEOUT_MS`, `ROUTE_API`, `PARENT_ORIGIN` |
| `PLACES`, `ROUTES`, `ROUTES_ORIGIN` | 도착지 10곳, 받아 둔 경로와 요금, 경로의 출발 기준점 |
| `PARAMS` | URL로 받는 값(`mode`, `dest`, `home`, `area`, `guide`, `voice`, `big`, `tutor`) |
| `SKILLS`, `SKILL_OF` | 기록하는 4단계와 화면 단계의 대응 |
| `S`, `fresh()`, `render()`, `setStep()`, `begin()`, `exitNow()` | 상태와 화면 전환 |
| `A` | 버튼 동작. HTML의 `data-a`, `data-v`와 연결돼요 |
| `MapCtl`, `KakaoMap`, `SvgMap`, `viewOf()` | 지도 표시 |
| `fetchRoute()`, `refreshLive()`, `routeData()`, `fareOf()` | 실제 경로와 요금 |
| `finish()`, `buildResult()`, `toHost()`, `parentAccepts()` | 결과 계산과 본 서비스로 전달 |

화면 순서: `home`(첫 화면) → `search` → `route` → `origin` → `calling` → `approach` → `plate` → `ride` → `arrive` → 결과.

## 3. 소유자를 바꿀 때

### GitHub
- 이미 공동 소유 조직이라 **명의 변경이 필요 없어요.** 사람을 추가하려면 조직의 People에서 초대해요.
- 조직 이름이나 저장소 이름을 바꾸면 공개 주소가 바뀌어요. 그때는 아래 "주소가 바뀔 때"를 함께 처리해요.

### 카카오
먼저 방법을 골라요.

**방법 A. 지금 앱을 유지하고 멤버로 추가 (권장)**
- 카카오 콘솔의 앱 설정 → **멤버**에서 새 담당자를 초대해요. 키가 바뀌지 않아서 코드도 그대로예요.

**방법 B. 새 사람 명의의 앱으로 옮기기**

아래를 **모두** 해야 해요. 하나라도 빠지면 그림 지도로 바뀌거나 경로가 곡선이 돼요.

1. 새 앱에서 제품 설정 → **카카오맵**을 사용 설정해요.
2. 앱 → **플랫폼 키** → 사용할 **JavaScript 키** → **JavaScript SDK 도메인**에 `https://baepu-team.github.io`를 등록해요. 도메인은 키마다 따로 등록해요. 로컬 시험에는 `http://127.0.0.1:5500`도 등록해요.
3. `index.html`의 `CONFIG.KAKAO_JS_KEY` 한 줄만 새 JavaScript 키로 바꿔요.
4. 새 앱의 **REST API 키**를 Cloudflare Worker의 Secret `KAKAO_REST_KEY`에 넣고 Deploy해요.
5. 카카오맵 무료 쿼터는 개발자 계정에서 **처음 활성화한 앱**에만 적용돼요. 그 계정에 다른 앱이 있으면 쿼터를 먼저 확인해요.
6. 공개 주소를 새로고침해서 카카오맵이 뜨는지, 핀을 150m 넘게 옮겼을 때 실제 경로가 나오는지 확인해요.

문제가 생겼을 때: 페이지 콘솔에 `그림 지도로 바꿨어요`가 나오면 카카오 스크립트를 불러오지 못한 거예요. 2026-11-09에는 키만 바꾸고 도메인을 등록하지 않아서 이 증상이 났어요. 브라우저에는 503으로 보였고, 원인은 `domain mismatched`(401)였어요. 사용량 초과와 혼동하지 마세요.

### Cloudflare
**방법 A. 계정 멤버로 추가**
- Cloudflare 계정의 멤버 초대 기능을 써요. 무료 플랜에서 어디까지 권한을 줄 수 있는지는 아직 확인하지 못했어요.

**방법 B. 새 사람 계정에 다시 만들기**
1. 새 계정에서 Workers를 **Start with Hello World**로 만들어요.
2. 코드를 `cloudflare/route-worker.js`로 바꾸고 Deploy해요.
3. Settings → Runtime variables and secrets에 Secret `KAKAO_REST_KEY`를 추가하고 Deploy해요.
4. 새 Worker 주소를 `index.html`의 `CONFIG.ROUTE_API`에 넣어요. 주소 끝의 `/route`는 유지해요.
5. 새 주소로 경로가 오는지 확인한 뒤 예전 Worker를 지워요.

### 주소가 바뀌거나 본 서비스에 끼워 넣을 때
페이지 주소가 바뀌면 세 곳을 함께 고쳐요.

- `index.html`의 `CONFIG.ROUTE_API` 조건에 있는 주소
- `cloudflare/route-worker.js`의 `ALLOWED_ORIGINS` (고친 뒤 Cloudflare에 Deploy)
- 카카오 JavaScript SDK 도메인

본 서비스의 iframe에 넣으면 `CONFIG.PARENT_ORIGIN`에 본 서비스 주소를 넣어요. 결과는 `postMessage`로 전달되고, 받는 쪽에서 `event.origin`을 확인해야 해요. GitHub Pages는 응답 헤더를 설정할 수 없어서 다른 사이트의 iframe 삽입을 막지 못해요.

## 4. 지켜야 할 것

**키**
- 저장소에 둘 수 있는 키는 도메인으로 제한되는 **카카오 JavaScript 키**뿐이에요.
- REST 키, Admin 키, 비밀번호는 파일, 커밋, 채팅에 절대 넣지 마세요. 이 저장소는 공개예요.

**함께 바꿔야 하는 값**
- 도착지를 바꾸면 `index.html`의 `PLACES`, `ROUTES`와 Worker의 `PLACES`를 함께 고쳐요.
- `ROUTES_ORIGIN`을 바꾸면 Worker의 `HOME`도 같이 고쳐요.

**화면과 문구**
- 어르신 기준이에요. 버튼은 크게, 한 화면에 할 일 하나, 쉬운 존댓말("~해요"), 잘못 눌러도 혼내지 않는 문구로 써요.
- "연습 화면 · 진짜로 호출·결제되지 않아요" 배너는 항상 유지해요. 실제 호출이나 결제를 연결하지 마세요.
- 실제 택시 앱의 로고, 이름, 캐릭터는 쓰지 않아요.

**개인정보**
- 탑승 위치는 결과에 넣지 않아요. 자녀 공유는 배움님이 동의했을 때만 보내요.

**수정할 때**
- GitHub 웹 편집기에 붙여넣을 때는 코드 전체를 선택한 뒤 붙여넣고, 저장 전에 바뀐 줄을 확인해요. GitHub가 자동으로 넣는 커밋 메시지는 실제 변경과 다를 수 있어요.
- 경로 서버를 고친 뒤에는 도착지 하나로 실제 응답을 확인해요. Worker는 허용한 주소에서 온 요청만 받아요.

## 5. 남은 확인과 제한

- 실제 휴대폰, 화면 낭독기로는 새 구성을 충분히 확인하지 못했어요.
- 카카오모빌리티 길찾기의 상업적 이용과 경로 저장 허용 여부는 출시 전에 확인해야 해요.
- GitHub Pages는 온라인 사업용 무료 호스팅으로 허용되지 않아요. 정식 출시 때는 호스팅을 다시 정해요.
- Worker의 호출 제한(IP당 분당 20회)은 서버 인스턴스별 안전장치라서 정확한 제한은 아니에요. 무료 플랜은 하루 10만 건까지예요.
- `?home=`으로 다른 집을 쓰면 Worker 범위를 벗어나서 곡선과 어림 요금으로 나와요.
