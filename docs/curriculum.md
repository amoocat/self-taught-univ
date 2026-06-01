# YouTube → 커리큘럼 생성 로직

STU에서 YouTube 플레이리스트를 가져와 커리큘럼(Course + Lecture)으로 저장하는 전체 흐름을 정리한 문서.

---

## 전체 흐름 요약

```
[사용자 입력 — 3가지 진입점]

  A. 플레이리스트 URL/ID 직접 입력
        ↓ GET /youtube/playlist-meta
  
  B. 영상 URL 입력 → 채널 탐색
        ↓ GET /youtube/channel-playlists?video_id=
        채널의 공개 플리 전체 목록

  C. 좋아요 영상 기반 채널 발견 (자동)
        ↓ GET /youtube/discover
        좋아요 영상 → 학습 관련 채널 → 채널별 학습 플리

        ↓ (공통)
[프론트: YouTube 모달]
  플리 선택 → "필터링 미리보기" → 학습 관련 영상만 표시
        ↓
  "강의로 저장" → POST /youtube/playlists/sync
        ↓
[백엔드: YouTube Data API v3]
  영상 목록 수집 → AI/데이터 관련 영상 필터링 → 카테고리 분류
        ↓
[백엔드: GPT-4o-mini]
  영상 제목 + 설명 → 태그 / 선수지식 자동 추출
        ↓
[DB: courses + lectures]
  category 기준 Course 매핑 → Lecture upsert
```

---

## 1. 사용자 입력 진입점 (프론트)

**파일:** `frontend/index.html`, `frontend/app.js`

YouTube 모달(`#ytImportModal`)은 2단계로 구성된다.

### Step 1 — 플레이리스트 선택

| 입력 방법 | 처리 함수 | 설명 |
|---|---|---|
| OAuth 로그인 후 내 플리 | `_ytLoadPlaylists()` | Google 계정 연동 시 내 플리 자동 표시 |
| 플레이리스트 URL/ID 입력 | `_ytAddSinglePlaylist(raw)` | `GET /youtube/playlist-meta` 호출 |
| **영상 URL 입력** | `_ytAddChannelPlaylists(raw, btn)` | `GET /youtube/channel-playlists` 호출 → 채널 전체 플리 표시 |

URL 타입 감지 로직 (`ytAddFromUrl`):
```javascript
const isVideo = /(?:v=|youtu\.be\/)([A-Za-z0-9_-]{11})/.test(raw)
             && !/(?:list=|\/playlist\/)/.test(raw);
// v= 있고 list= 없으면 영상 URL → 채널 탐색
// 그 외 → 단일 플리 추가
```

채널 탐색 흐름:
```
영상 URL 붙여넣기
    → GET /youtube/channel-playlists?video_id=xxx
    → 채널 헤더(.yt-channel-header) + 플리 목록 렌더링
    → 원하는 플리 체크 선택
```

### Step 2 — 필터 미리보기 + 저장

```
"필터링 미리보기 →" 클릭
    → POST /youtube/playlists/filter  (선택한 playlist_id 배열)
    → AI/데이터 관련 영상만 카테고리별로 표시
    → "강의로 저장" 클릭
    → POST /youtube/playlists/sync
```

---

## 2. API 엔드포인트

**파일:** `app/api/v1/youtube.py`

| 엔드포인트 | OAuth | 역할 |
|---|---|---|
| `GET /youtube/playlist-meta?id=` | 불필요 | 플리 URL/ID → 제목·썸네일 조회 |
| `GET /youtube/channel-playlists?video_id=` | 불필요 | 영상 URL/ID → 채널 공개 플리 전체 목록 |
| `GET /youtube/discover` | **필요** | 좋아요 영상 → 학습 채널 식별 → 채널별 학습 플리 반환 |
| `GET /youtube/playlists` | **필요** | 내 YouTube 계정 플리 목록 |
| `POST /youtube/playlists/filter` | 선택적 | 선택한 플리의 AI/데이터 영상만 필터링 (저장 안 함) |
| `POST /youtube/playlists/sync` | 선택적 | 필터링 결과를 DB에 저장 |
| `GET /youtube/preview/{playlist_id}` | 선택적 | 단일 플리 필터 미리보기 |
| `GET /youtube/oauth` | — | Google OAuth 시작 |
| `GET /youtube/oauth/callback` | — | 토큰 교환 후 저장 |
| `GET /youtube/oauth/status` | — | 인증 여부 확인 |

### URL 파싱 정규식

```python
_PLAYLIST_ID_RE = re.compile(r"(?:list=|/playlist/|youtu\.be/)([A-Za-z0-9_-]{10,})")
_VIDEO_ID_RE    = re.compile(r"(?:v=|youtu\.be/)([A-Za-z0-9_-]{11})")
```

---

## 3. YouTube Data API v3 크롤러

**파일:** `app/crawlers/youtube.py`

### 클래스: `YouTubeCrawler`

```python
crawler = YouTubeCrawler(api_key=settings.YOUTUBE_API_KEY)
```

| 메서드 | OAuth | 역할 | API 엔드포인트 |
|---|---|---|---|
| `fetch_playlist_videos(playlist_id, filter_ai)` | 선택적 | 플리 영상 수집 + AI 필터링 | `playlistItems.list` |
| `get_playlist_meta(playlist_id)` | 선택적 | 플리 제목·썸네일 | `playlists.list` |
| `fetch_user_playlists(access_token)` | **필요** | 내 계정 플리 목록 | `playlists.list` |
| `fetch_liked_videos(access_token)` | **필요** | 좋아요 영상 수집 + AI 필터링 + channel_id 포함 | `videos.list` |
| `get_video_channel(video_id)` | 불필요 | 영상 → 채널 ID·이름 | `videos.list` |
| `get_channel_playlists(channel_id)` | 불필요 | 채널 공개 플리 전체 | `playlists.list` |
| `_fill_durations(videos)` | 선택적 | ISO 8601 재생시간 → 초 변환 | `videos.list` |
| `check_video_availability(video_ids)` | 불필요 | 삭제/비공개 영상 감지 | `videos.list` |

### AI/데이터 관련 영상 필터링 (`filter_ai=True`)

`_classify_video(title, description)` 함수가 제목+설명을 소문자화 후 키워드 매칭.

| 카테고리 | 주요 키워드 예시 |
|---|---|
| `llm` | large language model, gpt-4, fine-tuning, rag, llama |
| `math` | linear algebra, eigenvalue, svd, 18.06, strang |
| `stat` | probability, bayesian, markov chain, statistical learning |
| `rl` | reinforcement learning, q-learning, policy gradient, ppo |
| `ml` | machine learning, random forest, xgboost, cs229 |
| `cv` | computer vision, cnn, object detection, cs231n |
| `nlp` | natural language processing, bert, transformer, cs224n |
| `dl` | deep learning, neural network, backpropagation, pytorch |
| `data` | data engineering, apache spark, kafka, airflow |
| `mlops` | kubernetes, docker, mlflow, model serving |
| `actuary` | actuarial, soa exam, ifrs17, life insurance |
| `ie` | industrial engineering, operations research, supply chain |

- 앞 카테고리가 먼저 매칭됨 (llm > math > stat > rl > ml > cv > nlp > dl > data > mlops > actuary > ie)
- 아무것도 매칭 안 되면 `None` 반환 → `filter_ai=True` 시 해당 영상 스킵

### 데이터 구조: `YoutubeVideo`

```python
@dataclass
class YoutubeVideo:
    video_id:     str
    title:        str
    description:  str        # 최대 500자
    thumbnail_url: str
    duration_sec: int        # _fill_durations()로 채워짐
    published_at: str
    playlist_id:  str
    position:     int        # 플리 내 순서 (0-indexed)
    category:     str        # _classify_video()로 자동 분류
```

---

## 4. DB 저장 로직

**파일:** `app/crawlers/scheduler.py` → `_save_lectures(videos)`

### 저장 규칙

1. `video.category`로 `courses` 테이블에서 매칭 Course 조회
2. `(course_id, number)` 조합으로 기존 Lecture 존재 여부 확인
3. 존재하면 **upsert** (youtube 관련 필드 + duration 갱신), 없으면 **insert**
4. 태그·선수지식이 비어있으면 GPT-4o-mini로 자동 추출

```python
lecture_number = v.position + 1  # position은 0-indexed

# upsert 대상 필드
exists.youtube_url      = f"https://youtube.com/watch?v={v.video_id}"
exists.youtube_video_id = v.video_id
exists.thumbnail_url    = v.thumbnail_url
exists.playlist_id      = v.playlist_id
exists.duration_sec     = v.duration_sec
exists.is_available     = True
```

### Course ↔ category 매핑

DB의 `courses.category` 컬럼 값으로 매핑. seed.py에서 초기 생성:

| category | 과목 |
|---|---|
| `math` | 선형대수학 (MIT 18.06) |
| `stat` | 확률론과 통계 |
| `ml` | 머신러닝 기초 |
| `dl` | 딥러닝 |
| `cv` | 컴퓨터 비전 |
| `nlp` | 자연어처리 |
| `llm` | 대규모 언어 모델 |
| `rl` | 강화학습 |
| `data` | 데이터 엔지니어링 |
| `mlops` | MLOps |
| `actuary` | 보험계리학 |
| `ie` | 산업공학 |

---

## 5. 태그/선수지식 자동 추출

**파일:** `app/services/tag_service.py`

GPT-4o-mini를 사용해 강의 제목 + 설명 + 카테고리를 기반으로:
- `tags`: 핵심 키워드 5개 이내
- `prerequisites`: 선수 지식 3개 이내

_save_lectures() 내에서 영상마다 호출됨. CHATGPT_API_KEY 없으면 빈 배열로 저장.

---

## 6. 배치 잡

**파일:** `app/crawlers/scheduler.py`

| 잡 | 스케줄 | 역할 |
|---|---|---|
| `job_crawl_youtube` | 매주 월요일 03:00 | `YOUTUBE_PLAYLISTS` 상수에 정의된 기본 플리 재수집 |
| `job_check_video_availability` | 매주 화요일 04:00 | DB 전체 강의 유효성 체크 → 삭제/비공개 영상 `is_available=False` |
| `job_tag_lectures` | 앱 시작 시 1회 | 태그 없는 강의 일괄 GPT 태깅 |

### 기본 수집 플레이리스트 (`YOUTUBE_PLAYLISTS`)

`app/crawlers/youtube.py` 상단에 하드코딩된 공개 플리:
- MIT 18.06 선형대수학
- Stanford CS229 머신러닝
- Stanford CS231n 딥러닝
- Stanford CS224n 자연어처리

---

## 7. DB 스키마 요약

```
courses
  id, title, source, category, order_index
  description, objectives (JSONB)

lectures
  id, course_id (FK)
  title, subtitle, number, category
  tags (JSONB), prerequisites (JSONB)
  youtube_url, youtube_video_id, thumbnail_url, playlist_id
  is_available, duration_sec
```

썸네일 표시 우선순위 (프론트):
```
lecture.thumbnail_url
    → img.youtube.com/vi/{youtube_video_id}/mqdefault.jpg  (fallback)
    → 빈 플레이스홀더
```

---

## 8. 한계 및 미구현 사항 (TODO)

- **중복 강의 처리**: 같은 영상이 다른 플리에 있으면 별도 Lecture로 중복 저장됨
- **커리큘럼 재구성**: 플리 영상 → GPT로 의미 기반 재분류·정렬 (Phase 0 TODO)
- **나중에 볼 영상 / 좋아요 영상**: OAuth 연동 후 추가 가능하나 미구현
- **배치 동기화**: 새 영상 추가·삭제 자동 반영 (일 1회) 미구현
- **LLM 기반 플리 관련도 판단**: 플리 수가 많을 때 GPT로 관련 플리 자동 체크 미구현
