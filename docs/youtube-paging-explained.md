# 페이지네이션과 클라이언트 상태 — 초심자를 위한 설명

이 문서는 두 가지를 설명합니다.

1. **페이지네이션 / 페이지 토큰** — 왜 한 번에 다 못 가져오는가
2. **클라이언트 상태** — 브라우저가 데이터를 어떻게 기억하는가

---

## 1. 왜 한 번에 다 못 가져오나요? (페이지네이션)

### 비유: 도서관 사서

유튜브 API는 도서관 사서 같아요. 내가 "좋아요 누른 영상 전부 주세요"라고 하면 사서가 이렇게 말합니다.

> "한 번에 50개까지만 드릴 수 있어요. 나머지 보려면 번호표 가져가세요."

그 **번호표**가 바로 `pageToken`입니다.

```
나: "좋아요 영상 주세요"
유튜브: (영상 50개) + "다음 번호표: abc123"

나: "번호표 abc123으로 다음꺼 주세요"
유튜브: (영상 50개) + "다음 번호표: def456"

나: "번호표 def456으로 다음꺼 주세요"
유튜브: (영상 23개) + (번호표 없음 — 끝!)
```

### 왜 50개 제한이 있나요?

유튜브 입장에서 생각해보면:
- 전 세계 수억 명이 동시에 API를 호출
- 한 번에 1000개씩 돌려주면 서버가 버팀
- **모든 API는 한 번 요청에 줄 수 있는 양을 제한**해요 (이걸 **rate limit** 또는 **pagination**이라고 해요)

### 우리 코드에서 어떻게 생겼나요?

**유튜브에 요청 (백엔드 `youtube.py`):**

```python
# 유튜브에 보내는 요청
params = {
    "myRating": "like",   # 좋아요 누른 영상
    "maxResults": 50,      # 최대 50개
    "pageToken": "abc123"  # 번호표 (첫 요청엔 없음)
}

# 유튜브가 돌려주는 응답
data = {
    "items": [...50개 영상...],
    "nextPageToken": "def456"  # 다음 번호표 (없으면 마지막 페이지)
}
```

**번호표를 저장해서 "더 보기" 구현 (프론트 `app.js`):**

```javascript
// 처음 발견 버튼 클릭 → 번호표 없이 첫 요청
const data = await _ytFetchDiscover(null);
_ytNextPageToken = data.next_page_token;  // 번호표 저장

// "더 보기" 클릭 → 저장해둔 번호표로 다음 요청
const data = await _ytFetchDiscover(_ytNextPageToken);
_ytNextPageToken = data.next_page_token;  // 새 번호표로 교체
```

### "더 보기" 버튼이 왜 나타났다 사라졌다 하나요?

```javascript
function _ytSyncDiscoverMoreBtn() {
    if (_ytNextPageToken) {
        // 번호표가 있다 = 아직 남은 데이터 있음 → 버튼 보여줌
        btn.style.display = '';
    } else {
        // 번호표가 없다 = 다 가져옴 → 버튼 숨김
        btn.style.display = 'none';
    }
}
```

---

## 2. 브라우저가 데이터를 기억하는 방법 (클라이언트 상태)

### 비유: 포스트잇

브라우저에서 실행되는 JavaScript는 **메모장**을 가지고 있어요.  
변수를 선언하면 그 메모장에 뭔가를 적어두는 거예요.

```javascript
let _ytNextPageToken = null;  // 메모장에 "다음 번호표" 칸 만들기
```

페이지를 새로고침하면 메모장이 사라집니다. **브라우저 메모리에만 저장**돼 있으니까요.

### 우리 코드의 주요 메모장들

```javascript
// ─── 유튜브 모달 관련 메모장 ───────────────────────────────────

let _ytPlaylists = [];
// 현재 모달에 표시된 플레이리스트 목록
// 예: [{playlist_id: "PL123", title: "선형대수"}, ...]

let _ytSelected = new Set();
// 체크박스로 선택한 playlist_id들
// Set = 중복 없는 집합. 예: Set{"PL123", "PL456"}
// 체크 → .add("PL123")  /  체크 해제 → .delete("PL123")

let _ytNextPageToken = null;
// 유튜브에서 받은 다음 페이지 번호표
// null이면 더 가져올 게 없음

let _registeredPlaylistIds = new Set();
// DB에 이미 저장된 playlist_id들
// 서버에서 한 번 가져와서 여기 저장해 두면
// 이후엔 서버 왕복 없이 즉시 확인 가능

let _ytDisplayedChannels = new Set();
// 이미 헤더를 표시한 채널 ID들
// "쑤튜브" 헤더가 두 번 뜨지 않게 막는 역할
```

### "등록됨" 뱃지는 어떻게 동작하나요?

**전체 흐름:**

```
1. 모달 열림
      ↓
2. 서버에 요청: "DB에 저장된 playlist_id 목록 줘"
      ↓
3. 응답: ["PL123", "PL456", "PL789"]
      ↓
4. 메모장에 기록: _registeredPlaylistIds = {"PL123", "PL456", "PL789"}
      ↓
5. 플리 목록 렌더링할 때 각각 확인:
   "PL123이 메모장에 있나?" → 있음 → "등록됨" 뱃지 추가
   "PL999이 메모장에 있나?" → 없음 → 뱃지 없음
```

**코드로 보면:**

```javascript
// 서버에서 등록된 playlist_id 목록 가져오기
async function _ytLoadRegisteredPlaylists() {
    const res  = await fetch('/api/v1/youtube/registered-playlists');
    const data = await res.json();
    // data = { playlist_ids: ["PL123", "PL456"] }

    _registeredPlaylistIds = new Set(data.playlist_ids);
    // Set으로 만들면 "이 ID가 있나?" 확인이 매우 빠름
    // (배열은 처음부터 끝까지 하나씩 비교, Set은 즉시 확인)
}

// 플리 항목 HTML 만들 때 뱃지 여부 결정
function _ytPlItemHtml(i, pl, metaText) {
    const reg = _registeredPlaylistIds.has(pl.playlist_id);
    // .has() = "이 값이 Set 안에 있나?" → true/false

    return `
        <div class="yt-pl-name">
            ${pl.title}
            ${reg ? '<span class="yt-pl-reg-badge">등록됨</span>' : ''}
            <!--       ↑ reg가 true면 뱃지 HTML 추가, false면 빈 문자열 -->
        </div>
    `;
}
```

### 왜 매번 서버에 물어보지 않고 메모장에 저장하나요?

서버에 매번 물어보면:

```
플리 100개 렌더링
→ 각각 "이거 등록됐어?" 서버에 질문 100번
→ 네트워크 왕복 100번
→ 느리고, 서버 부하 큼
```

메모장에 저장해두면:

```
모달 열릴 때 서버에 1번만 질문
→ 결과를 _registeredPlaylistIds에 저장
→ 이후 확인은 메모장(.has())으로 즉시 해결
→ 서버 왕복 0번
```

이걸 **캐싱(caching)** 이라고 해요. "한 번 가져온 걸 가까운 곳에 저장해두고 재사용"하는 것.

---

## 3. 전체 흐름 한눈에 보기

```
[모달 열림]
    │
    ├─ _ytLoadRegisteredPlaylists()
    │       └─ GET /youtube/registered-playlists
    │               └─ DB 조회: lectures.playlist_id 목록
    │               └─ 응답: ["PL123", "PL456"]
    │       └─ _registeredPlaylistIds = Set{"PL123", "PL456"}
    │
    └─ _ytLoadPlaylists()
            └─ 내 계정 플리 목록 가져오기
            └─ 각 플리 렌더링 (뱃지 자동 표시)

[👍 좋아요 영상에서 채널 발견 클릭]
    │
    └─ ytDiscover()
            └─ _ytFetchDiscover(null)  ← pageToken 없음 = 첫 페이지
                    └─ GET /youtube/discover
                            └─ 좋아요 영상 50개 가져오기
                            └─ 학습 관련만 필터링
                            └─ 채널별 그룹화
                            └─ 각 채널 플리 조회 (동시에)
                            └─ 응답: {channels: [...], next_page_token: "abc123"}
            └─ _ytRenderDiscoverChannels(channels)  ← 화면에 그리기
            └─ _ytNextPageToken = "abc123"  ← 번호표 저장
            └─ _ytSyncDiscoverMoreBtn()  ← 번호표 있으니 "더 보기" 버튼 표시

[더 보기 → 클릭]
    │
    └─ ytDiscoverMore()
            └─ _ytFetchDiscover("abc123")  ← 저장해둔 번호표 사용
                    └─ GET /youtube/discover?page_token=abc123
                    └─ 응답: {channels: [...], next_page_token: null}  ← 마지막 페이지
            └─ _ytRenderDiscoverChannels(channels)
            └─ _ytNextPageToken = null  ← 번호표 없음
            └─ _ytSyncDiscoverMoreBtn()  ← 번호표 없으니 "더 보기" 버튼 숨김
```

---

## 4. 성능 최적화 — 왜 느렸고 어떻게 고쳤나

### 문제: 채널 발견이 너무 느림

"좋아요 영상에서 채널 발견" 버튼을 눌렀을 때 흐름을 보면:

```
1. 좋아요 영상 50개 가져오기         ← API 1회 호출 (빠름)
2. 채널별로 묶기                     ← 메모리 연산 (즉시)
3. 각 채널마다 플레이리스트 목록 조회 ← 여기가 문제!
```

3번 단계가 느린 이유:

```
좋아요 50개 → 15개 채널 추출
  ↓
asyncio.gather(채널1 플리 조회, 채널2 플리 조회, ..., 채널15 플리 조회)
            ↑ 15개 API 호출이 동시에 실행

대형 채널(MIT, Stanford) → 플리 100개+ → API 2~3번 순차 호출
  ↓
채널1: [API 호출] → [API 호출] → [API 호출]  ← 3번 × 300ms = 900ms
채널2: [API 호출]                              ← 1번 × 300ms = 300ms
...

전체 대기 시간 = 가장 느린 채널의 시간 = 900ms+
```

### 해결: 채널 플리는 첫 페이지(50개)만 가져오기

```python
# 수정 전
pls = await crawler.get_channel_playlists(ch["channel_id"])
# MIT 채널: API 3번 순차 호출 → 900ms

# 수정 후
pls = await crawler.get_channel_playlists(ch["channel_id"], max_pages=1)
# MIT 채널: API 1번 → 300ms
```

`get_channel_playlists()`에 `max_pages` 파라미터를 추가해서:
- `max_pages=1` → 첫 50개만 (discover용 — 학습 채널은 보통 50개면 충분)
- `max_pages=None` (기본값) → 전체 (채널 URL로 직접 탐색할 때)

### 왜 첫 50개만 해도 괜찮나요?

YouTube 플레이리스트는 최신 순으로 정렬됩니다.  
학습 채널에서 첫 50개 안에 학습 관련 플리가 대부분 포함됩니다.  
"더 보기" 버튼으로 다음 좋아요 페이지를 계속 가져오면 점점 더 많은 채널을 발견하게 됩니다.

### 성능 비교

| 상황 | 수정 전 | 수정 후 |
|------|---------|---------|
| 좋아요 50개 / 채널 10개 (소규모) | ~1-2초 | ~300-500ms |
| 좋아요 50개 / 채널 15개 (대형 포함) | ~3-5초 | ~500ms-1초 |

---

## 5. 핵심 개념 정리

| 개념 | 한 줄 설명 | 비유 |
|---|---|---|
| **페이지네이션** | 많은 데이터를 나눠서 보내는 것 | 책의 페이지 |
| **pageToken** | 다음 페이지 위치를 가리키는 문자열 | 도서관 번호표 |
| **클라이언트 상태** | 브라우저 JS 변수에 임시 저장된 데이터 | 포스트잇 메모 |
| **캐싱** | 서버에서 한 번 가져온 걸 가까운 곳에 저장 | 책을 다시 도서관 안 가고 책상에 두기 |
| **Set** | 중복 없는 집합, `.has()`로 빠르게 확인 | 출석부 (있냐 없냐만 체크) |

---

> **주의:** 클라이언트 상태는 새로고침하면 사라집니다.  
> 그래서 모달을 열 때마다 `_ytLoadRegisteredPlaylists()`를 다시 호출해서  
> 서버에서 최신 데이터를 가져옵니다.
