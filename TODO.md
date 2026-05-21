# STU (Self-Taught University) — TODO & 고도화 플랜

> 이 파일은 Claude Code에서 자동으로 읽힘.
> 작업 완료 시 [ ] → [x] 로 바꿔줘.
> [x] 항목이 생기면 해당 섹션에서 제거하고 맨 아래 `## ✅ 완료된 것들` 섹션의 적절한 소제목 아래로 옮겨줘.

---

## 🚨 Phase 0 — 남은 항목

### 커리큘럼
- [ ] 학습 프로그램 가져오기
    - [x] 플레이리스트 URL 직접 입력 — `GET /api/v1/youtube/playlist-meta`
    - [x] 영상 URL 입력 → 채널 전체 플리 탐색 — `GET /api/v1/youtube/channel-playlists`
    - [x] 좋아요 영상 기반 채널 자동 발견 — `GET /api/v1/youtube/discover` (학습 영상 필터링 → 채널 식별 → 채널별 플리 병렬 조회)
- [ ]  유튜브 플리에서 긁어온 영상들을 백엔드에서 재구성해서 커리큘럼으로 재구성해야함 (GPT를 통해서 or RAG를 통해서 재분류)


## 🎬 YouTube 채널 플리 탐색
> 저장된 영상 → 업로더 채널 → 채널 전체 플리 수집

- [ ] `get_video_channel` tool 추가 (video_id → channel_id, channel_title)
- [ ] `get_channel_playlists` tool 추가 (channel_id → 해당 채널의 전체 플리 목록)
- [ ] `get_multiple_playlists` 와 연결해서 채널 플리 전체 영상 수집까지 one-shot으로

**흐름:**
```
내가 저장한 영상 (예: 선대 1강)
    ↓ video_id로 channel_id 조회
채널 페이지 (예: 쑤튜브)
    ↓ channel_id로 플리 목록 조회
선형대수 전체 강의 플리
    ↓ playlist_id로 영상 전체 수집
커리큘럼 생성
```


### 렉쳐 노트
- [ ] **렉쳐 노트 내용 전부 비어있음** — DB에 `LectureNote` 데이터 없음. 최소한 선형대수 몇 강 분 수동 입력 필요 -> 나중에는 AI를 통해 생성 

### 지식 그래프
- [ ] **그래프 데이터 항상 fallback** — CHATGPT_API_KEY 설정 완료됨, 노트 저장 후 자동 해결됨

### AI 챗봇
- [ ] **컨텍스트 바 하드코딩** — 실제 강의 상태 반영 미구현
- [ ] **취약 개념 칩 하드코딩** — 동적 생성 미구현

---

## 🔴 Phase 2 — 진행 중

### 강의 구성 고도화
- [x] `lectures` 테이블에 YouTube 필드 추가 — `youtube_video_id`, `thumbnail_url`, `playlist_id`, `is_available` (migration 0006)
- [x] 프론트: 강의 목록에 썸네일 표시 (`youtube_video_id` → `img.youtube.com` fallback), 재생시간·완료 표시
- [x] 배치: 주기적으로 영상 유효성 체크 → 삭제·비공개 시 `is_available = false` 처리 (매주 화요일 4시, `job_check_video_availability`)
- [ ] 최신 동향 자동 크롤링 → 피드 페이지 통합 (Naver D2, 당근 테크, 테크 유튜브)

### 내 YouTube 계정 연동
- [ ] **플레이리스트 안의 영상의 수가 너무 많을 때 LLM으로 AI/데이터 관련 영상 자동 추가** — 플리 제목+설명을 GPT에게 넘겨서 관련도 점수 매기고, 관련 플리는 자동 체크 + 상단 정렬
- [ ] 배치: 일 1회 동기화 — 새 영상 추가/삭제 자동 반영 (APScheduler 기존 youtube job 활용)

### AI 기능
- [ ] 노트 임베딩 생성 (pgvector) → 시맨틱 검색 (아래 Phase 3 참고)

### MCP 개발 (학습봇용) — 우선순위 순
- [ ] **1순위** STU 자체 MCP — 진도·노트·취약점 DB 조회
- [ ] **2순위** Brave 웹 검색 MCP — 모르는 개념 즉시 검색
- [ ] **3순위** arXiv MCP — 논문 검색·요약
- [ ] **4순위** YouTube MCP — 강의 검색
- [ ] **5순위** Obsidian MCP — 대화 내용 노트 자동 저장
- [ ] **6순위** 테크 블로그 크롤링 MCP — 기존 크롤러를 MCP 인터페이스로 래핑
- [ ] **7순위** Obsidian 링크 자동정리 MCP — 링크 붙여넣으면 요약·태그·노트 자동 생성
- [ ] **8순위** Gemini 파이프라인 MCP — 회사 Gemini로 논문·자료 요약 → Obsidian → STU
- [ ] **9순위** YouTube 시청기록 MCP — 시청 기록 기반 강의 진도율 자동 반영
- [ ] **10순위** 강의, 논문, 테크블로그 기반으로 지식베이스 구축, RAG를 통해 테스트용 챗봇 고도화

### 인프라 — Jenkins + ArgoCD CD 파이프라인 구축

> 목표 흐름: `git push` → Jenkins (테스트 + Docker 빌드/push) → ArgoCD (k8s 배포)

#### Step 1. minikube + ArgoCD 설치
- [ ] minikube 시작: `minikube start --driver=docker --cpus=4 --memory=6g`
- [ ] Ingress 활성화: `minikube addons enable ingress`
- [ ] ArgoCD 설치:
  ```bash
  kubectl create namespace argocd
  kubectl apply -n argocd -f https://raw.githubusercontent.com/argoproj/argo-cd/stable/manifests/install.yaml
  ```
- [ ] ArgoCD 초기 admin 비밀번호 확인: `kubectl get secret argocd-initial-admin-secret -n argocd -o jsonpath="{.data.password}" | base64 -d`
- [ ] ArgoCD UI 포트포워딩: `kubectl port-forward svc/argocd-server -n argocd 8080:443`

#### Step 2. Jenkins 설치 (minikube 내부 or Docker)
- [ ] Jenkins Docker 실행:
  ```bash
  docker run -d --name jenkins \
    -p 8090:8080 -p 50000:50000 \
    -v jenkins_home:/var/jenkins_home \
    -v /var/run/docker.sock:/var/run/docker.sock \
    jenkins/jenkins:lts
  ```
- [ ] 초기 admin 비밀번호: `docker exec jenkins cat /var/jenkins_home/secrets/initialAdminPassword`
- [ ] 플러그인 설치: Git, Pipeline, Docker Pipeline, Credentials Binding

#### Step 3. Jenkins Credentials 등록
- [ ] `dockerhub-creds` — Docker Hub 계정 (Username + Password)
- [ ] `argocd-token` — ArgoCD API 토큰 (Secret text)
  - ArgoCD 토큰 발급: `argocd account generate-token --account admin`
- [ ] `github-token` — GitHub PAT (repo + webhook 권한)

#### Step 4. Jenkinsfile 설정값 수정
- [ ] `IMAGE_NAME` → 실제 Docker Hub 계정으로 변경 (현재 `yourdockerhub/stu-api`)
- [ ] `ARGOCD_SERVER` → 실제 ArgoCD 주소로 변경 (현재 `argocd.stu.local`)

#### Step 5. GitHub Webhook → Jenkins 연결
- [ ] GitHub repo Settings → Webhooks → `http://<jenkins-ip>:8090/github-webhook/` 등록
- [ ] Jenkins에서 Pipeline 잡 생성: SCM → GitHub repo, `Jenkinsfile` 경로 지정

#### Step 6. ArgoCD Application 등록
- [ ] `argocd/app-dev.yaml` 적용:
  ```bash
  kubectl apply -f argocd/app-dev.yaml
  ```
- [ ] repo URL이 실제 GitHub repo 주소와 일치하는지 확인
- [ ] ArgoCD UI에서 `stu-dev` app Sync 확인

#### Step 7. 엔드투엔드 테스트
- [ ] `develop` 브랜치에 커밋 push → Jenkins 자동 트리거 확인
- [ ] Jenkins 빌드 로그: 테스트 통과 → Docker push → ArgoCD sync 순서 확인
- [ ] `kubectl get pods -n default` — Pod 새 이미지로 롤링 업데이트 확인
- [ ] `/healthz` 또는 `/docs` 응답 확인

---
- [ ] API 키 사용량 대시보드
- [ ] DB, 서버 등을 로컬 말고 클라우드 환경으로 이관

---

## 🔵 Phase 3 — 그래프 임베딩 기반 RAG & 시맨틱 서치

> 지식 그래프의 노드(개념/키워드)와 노트·논문 문서를 벡터로 임베딩해서
> "이 개념이랑 비슷한 거 뭐 있어?", "이 내용 내가 공부했어?" 같은 검색을 가능하게 함.

### 3-1. 벡터 DB 세팅
- [ ] PostgreSQL에 `pgvector` 익스텐션 활성화 (`CREATE EXTENSION vector;`)
- [ ] `embeddings` 테이블 설계: `(id, source_type, source_id, vector, metadata)`
  - `source_type`: `note` / `paper` / `lecture` / `concept_node`
- [ ] alembic 마이그레이션 작성

### 3-2. 임베딩 생성 파이프라인
- [ ] 임베딩 모델 선택
  - 1안: `text-embedding-3-small` (OpenAI, 유료, 품질 우수)
  - 2안: `intfloat/multilingual-e5-large` (로컬, 무료, 한국어 강함) ← 추천
- [ ] 임베딩 생성 서비스 작성: `app/services/embedding_service.py`
  - 노트 저장 시 자동 임베딩 트리거 (FastAPI event / Celery task)
  - 논문 크롤링 시 abstract 자동 임베딩
  - 렉쳐 노트 저장 시 섹션 단위 임베딩
- [ ] 배치 재임베딩 스크립트 (기존 데이터 소급 처리)

### 3-3. 그래프 노드 임베딩 (Graph Embedding)
- [ ] 노드 텍스트화 전략 결정
  - 노드명 + 연결된 노드명들 + 해당 노트 요약을 합쳐서 임베딩
- [ ] 그래프 노드 임베딩 생성: `app/services/graph_embedding_service.py`
- [ ] 노드 추가/수정 시 임베딩 자동 갱신
- [ ] (선택) Node2Vec / GraphSAGE 같은 그래프 전용 임베딩 도입 검토

### 3-4. 시맨틱 서치 API
- [ ] `GET /api/v1/search?q=&type=` — 통합 시맨틱 검색 엔드포인트
  - `type`: `all` / `notes` / `papers` / `lectures` / `concepts`
  - 쿼리 텍스트 → 임베딩 → pgvector cosine similarity 검색
- [ ] 하이브리드 서치 (선택): 키워드 검색 + 시맨틱 검색 결과 RRF로 합산
- [ ] 검색 결과를 프론트 검색바에 연결

### 3-5. RAG 기반 챗봇 고도화
- [ ] 챗봇 질문 → 임베딩 → 유사 노트/논문/렉쳐 top-k 검색
- [ ] 검색된 문서를 GPT 프롬프트 컨텍스트에 주입
- [ ] 답변에 출처 표시 (어떤 노트/논문에서 가져온 내용인지)
- [ ] 테스트 모드: "이 개념 설명해봐" → 내 노트와 대조해서 채점

### 3-6. 프론트 연결
- [ ] 통합 검색바 → 시맨틱 서치 API 연결
- [ ] 지식 그래프: 노드 클릭 시 "유사한 개념" 사이드패널 표시
- [ ] 노트 에디터: 작성 중 유사 노트/논문 자동 추천
- [ ] 챗봇: 답변에 참조 노트 링크 표시

---

## 🟢 나중에 (Phase 4~6 — 인프라 고도화)

### Phase 4 — Redis 제대로 활용
- [ ] API 응답 캐싱 (피드 목록, 논문 목록, 커리큘럼)
- [ ] 챗봇 세션 Redis 저장
- [ ] 크롤링 중복 URL 체크 Redis Set
- [ ] 임베딩 결과 캐싱 (같은 텍스트 재임베딩 방지)
- [ ] Rate limiting 미들웨어

### Phase 5 — MongoDB 도입
- [ ] 논문 전문(full text) MongoDB 저장
- [ ] 렉쳐 노트 본문 MongoDB 이전
- [ ] PostgreSQL(메타) + MongoDB(본문) 혼합 구조

### Phase 6 — Kafka + Flink
- [ ] 크롤러 → Kafka topic 발행
- [ ] Flink로 실시간 요약 생성 파이프라인
- [ ] 실시간 추천 (공부 패턴 → 다음 논문 추천)
- [ ] 크롤러 실패 실시간 감지

## 🟣 Phase 7 — 기타 사이드 프로젝트 & 실험

- [ ] 사주 챗봇 — 생년월일 입력 → 사주 해석 + GPT 대화
- [ ] 멘탈케어 MCP — 블로그 일기 읽고 페르소나 학습 → 맞춤형 멘탈케어 챗봇
- [ ] ETL 그래프 MCP — 데이터 파이프라인 구조 자동 시각화
- [ ] 포트폴리오 MCP — Obsidian 회사 기록 정리 → 포트폴리오 자동 구성
- [ ] 0원 챌린지 — 무료 티어 조합(Vercel + Railway + Supabase 등)으로 STU 운영 한계 탐색
- [ ] 대규모 트래픽 실험
- [ ] 웹사이트 대문 생성 (yale, uc berkely, sogang univ 같은 대학 홈페이지 참고)

- [ ] 신규 강좌 추가 — TED 행복 강좌 (wellbeing 카테고리 신설)
- [ ] 신규 강좌 추가 — MLVU (바탕화면 폴더 영상 → 로컬 import 방식 결정 필요)

---

## 📊 웹 로그 / 세션 / 쿠키
> 실제 데이터팀 스타일의 로그 데이터 생성

- [ ] FastAPI 미들웨어로 요청 로깅 추가
  - `user_id` (로그인 유저 or anonymous)
  - `session_id` (쿠키 기반)
  - `event_type` (`page_view` / `click` / `search`)
  - `path`, `referrer`, `user_agent`
  - `timestamp`
- [ ] 세션 구성 (Redis 또는 DB 기반)
- [ ] 쿠키 설정 (`session_id` 발급 및 유지)
- [ ] 로그 저장 테이블 (`event_logs`) 마이그레이션 추가
- [ ] 프론트에서 클릭 이벤트 전송 엔드포인트 (`POST /api/events`)

**로그 테이블 스키마 (안):**
```sql
event_logs
  id          BIGSERIAL PK
  session_id  TEXT
  user_id     INTEGER (nullable, FK → users)
  event_type  TEXT        -- page_view | click | search
  path        TEXT
  referrer    TEXT
  properties  JSONB       -- 이벤트별 추가 데이터 (검색어, 클릭 대상 등)
  user_agent  TEXT
  ip_hash     TEXT        -- 개인정보 보호용 해시
  created_at  TIMESTAMPTZ DEFAULT now()
```

---

## 🔍 검색 기능
> 앱 내 강의 및 렉처노트 검색

- [ ] `GET /api/lectures/search?q=` 엔드포인트 추가
- [ ] `GET /api/notes/search?q=` 엔드포인트 추가
- [ ] 검색 대상 필드 정의
  - 강의: `title`, `description`, `category`, `tags`
  - 렉처노트: `title`, `content`
- [ ] PostgreSQL `tsvector` 풀텍스트 검색 또는 `ILIKE` 방식 결정
- [ ] 검색 결과 페이지네이션
- [ ] 프론트 검색 UI 연동

### 최종 목표 스택
```
크롤러 → Kafka → Flink → PostgreSQL (관계형 + pgvector)
                       → MongoDB (비정형 문서)
                       → Redis (캐시·세션·임베딩 캐시)
                       → FastAPI → 프론트
                       -> Elastic Search (검색)
```

---

## ✅ 완료된 것들

### Phase 0 — 깨져있던 것들 수정

- [x] **CHATGPT_API_KEY 미설정** — `.env` 재생성 후 키 설정 완료
- [x] **DB 초기 데이터 없음** — `app/db/seed.py` 작성, 앱 시작 시 자동 실행. 6개 과목 + 106개 강의 삽입
- [x] **홈 학기 진도 현황 하드코딩** → `initHome()` 함수로 API 데이터 동적 렌더링
- [x] **홈 사이드바 과목 % 하드코딩** → `initHome()`에서 API 데이터로 동적 렌더링
- [x] **홈 사이드바 과목 클릭 → 강의 페이지 이동 안 됨** → `gotoLecture(courseId)` 연결
- [x] **홈 프로필 드롭다운 수치 하드코딩** → 실제 API 값 주입
- [x] **홈 상단 링크 무반응** → `goto('about')`, `goto('curriculum')` 연결
- [x] **노트 삭제 버튼 없음** → ✕ 버튼 + `obsDelete()` 함수 구현
- [x] **논문 추가 UI 없음** → arXiv ID/URL 입력 폼 + `POST /api/v1/papers/` 엔드포인트 (arXiv API 메타데이터 자동 수집)
- [x] **논문 자동 크롤링 없음** → arXiv 크롤러 (cs.AI/LG/CV/CL 등) 매일 새벽 2시 30분 자동 수집. rate limit 429 수정
- [x] **논문 검색 없음** → 검색 input + `searchPapers()` 구현
- [x] **블로그 소스 필터 동작 안 함** → `_blogSourceFilter` 상태 + `_renderBlogFeed()` 구현
- [x] **블로그 카테고리 탭 동작 안 함** → `_blogTabFilter` 상태 연결
- [x] **블로그 검색 동작 안 함** → `searchBlog()` 구현
- [x] **블로그 아티클 "원문 보기" 링크 없음** → `🔗 원문 보기` 버튼 추가
- [x] **지식 그래프 노드 클릭 → 노트 없으면 무반응** → "관련 노트 없음 + 새 노트 작성" 툴팁 표시

### Phase 2 — 강의/과목 고도화

- [x] `lectures` 스키마에 `tags`, `subtitle`, `prerequisites` 필드 추가 (JSONB) + alembic 마이그레이션 0003–0004
- [x] `courses` 스키마에 `description`, `objectives` 필드 추가 + alembic 마이그레이션 0005
- [x] `app/services/tag_service.py` — GPT-4o-mini 기반 강의 태그·선수지식 자동 추출
- [x] `_CATEGORY_RULES` 13개 카테고리로 확장 (llm, rl, actuary, ie 신설, infra→mlops, stats→stat)
- [x] 신규 과목 6개 시드 추가 (llm, rl, data, mlops, actuary, ie)
- [x] YouTube 플리 가져오기 팝업 모달로 개편 (2-step: 플리 선택 → 필터 미리보기 → 저장)
- [x] `POST /api/v1/youtube/playlists/filter` — 저장 없이 필터 결과만 미리보기
- [x] `PATCH /api/v1/curriculum/{course_id}` — description·objectives DB 직접 편집
- [x] 커리큘럼 카드 클릭 → 과목 상세 팝업 (강의 목록·진도·설명·학습목표 + 편집 기능)
- [x] seed.py에서 description/objectives 하드코딩 제거 (DB에서 관리)
- [x] YouTube 플리 모달 스크롤 수정 — `#ytStep1/#ytStep2` flex 레이아웃, overlay z-index, 스크롤바 shift 보정
- [x] 플리 클릭 시 영상 목록 accordion 확장 — filter 엔드포인트 재사용, 학습 관련 영상만 미리보기

### Phase 2 — YouTube 연동

- [x] YouTube OAuth 2.0 인증 플로우 구현 — Google 로그인 → token 저장 → 자동 갱신 (`oauth_tokens/youtube.json`)
- [x] `GET /api/v1/youtube/playlists` — 내 계정 플레이리스트 목록 조회
- [x] `GET /api/v1/youtube/preview/{id}` — 저장 전 필터 결과 미리보기
- [x] `POST /api/v1/youtube/playlists/sync` — 선택한 플리 크롤링 → DB 저장
- [x] 플레이리스트 체크박스 선택 UI — 커리큘럼 탭 하단 'YouTube 강의 연동' 섹션
- [x] AI/데이터 관련 영상만 키워드 필터링 (math/ml/dl/nlp/cv/llm/data/stat/infra 9개 카테고리, 무관 영상 자동 스킵)
- [x] feed_items·lectures·papers `category` 칼럼 추가 + alembic 마이그레이션
- [x] 블로그 크롤러 자동 카테고리 분류 (키워드 매칭)

### 프론트엔드

- [x] 백엔드 API 응답 스펙 정렬 (notes/graph/feed/curriculum/lectures)
- [x] `GET /api/v1/notes` 응답 → `{ id, title, content, tags[], updated }` 수정
- [x] `GET /api/v1/graph` 신규 엔드포인트 생성
- [x] `GET /api/v1/feed` 응답 → `{ source, badge, date, title, summary, keywords[], courses[], related_paper, color }` 변환
- [x] `GET /api/v1/curriculum` 응답 → `{ code, title, source, progress_pct, status }` 수정
- [x] `GET /api/v1/curriculum/lectures/{id}` 신규 (content 필드 포함)
- [x] `const OBS_NOTES` → `obsInit()`에서 API fetch / obsNewNote → POST / obsSave → PUT
- [x] `[[링크]]` 자동완성 API 기반으로 동작
- [x] `const BLOG_POSTS` → `goto('blog')` 시 API fetch + 동적 렌더링
- [x] `const GRAPH_NODES/EDGES` → `drawGraph()` 시 API fetch (fallback 포함)
- [x] 커리큘럼 카드 동적 렌더링 (`progress_pct` API 기반)
- [x] 렉쳐 목록 동적 렌더링 + `ll-item` 클릭 시 `marked.js`로 노트 렌더링
- [x] 강의 페이지 YouTube 영상 임베드 (과목별 실제 강의 URL 포함)
- [x] 프론트엔드 리팩토링 — `style.css` / `app.js` 분리 (5024줄 → HTML 884 · CSS 3060 · JS 1080)
- [x] URL 파일명 숨기기 — `index.html`로 rename → `http://localhost:8000/` 로 서빙
- [x] SPA 라우팅 — hash 기반 (`#page`) + `popstate` 리스너 + `initFromHash()` IIFE
- [x] 논문 목록 동적 렌더링 — `initPapers()` + `/api/v1/papers/` fetch
- [x] 논문 뷰어 동적 렌더링 — `loadPaper()` + `/api/v1/papers/{id}` fetch (abstract·authors·arXiv 링크)
- [x] 홈 / STU 소개 / 커리큘럼 페이지
- [x] 렉쳐 노트 + 내 노트 반반 레이아웃
- [x] 내 노트 Obsidian 스타일 에디터 (CodeMirror + [[링크]])
- [x] 논문 읽기 (AI 키워드 주석)
- [x] 테크 블로그 피드
- [x] 지식 그래프 D3.js force simulation
- [x] 플로팅 AI 챗봇 (학습/테스트 모드)
- [x] 학생 프로필 드롭다운

### 백엔드

- [x] 논문 주석 자동 생성 — `POST /api/v1/papers/{id}/annotate` (GPT-4o, 키워드·설명 추출)
- [x] 노트 저장 시 키워드 자동 추출 → GraphNode/GraphEdge 자동 생성 (gpt-4o-mini 백그라운드)
- [x] 강의 페이지 과목별 분리 (커리큘럼 카드 클릭 → 해당 과목, 과목 선택기, 완료 표시, 강의별 노트 패널)
- [x] pytest 테스트 작성 (notes, curriculum, feed, papers — 37개 테스트, 실 DB 대상)
- [x] API 에러 핸들링 통일 (HTTPException → 커스텀 에러 클래스)
- [x] FastAPI 프로젝트 구조
- [x] SQLAlchemy 모델 (13개 테이블)
- [x] CRUD API (notes, curriculum, chat, papers, feed, graph)
- [x] ChatGPT API 챗봇 스트리밍 (gpt-4o, SSE 스트리밍, 학습/테스트 모드)
- [x] 챗봇 — 프론트 실제 GPT 스트리밍 연결 (SSE ReadableStream, 토큰 단위 렌더링, 대화 히스토리 DB 저장, 세션 관리)
- [x] 같이 논문 읽어주는 챗봇 — 논문 뷰어에 Q&A 패널 추가
- [x] 시험볼때 힌트 챗봇 — 강의 노트 컨텍스트 기반 단계적 힌트 제공
- [x] YouTube API 키 발급 + OAuth 설정 완료
- [x] APScheduler 배치 크롤러
- [x] YouTube / arXiv / 블로그 크롤러
- [x] 블로그 크롤러 ML/data 필터링
- [x] Docker Compose 로컬 환경
- [x] alembic 마이그레이션
- [x] 저명 논문 8개 seed
- [x] Dockerfile entrypoint에 `alembic upgrade head` 자동화
- [x] `.env.example` 파일 작성

### 인프라

- [x] K8s YAML (Deployment, Ingress, Storage)
- [x] Jenkinsfile CI 파이프라인
- [x] GitHub Actions CI (develop·staging·main 브랜치 트리거 포함)
- [x] ArgoCD Application YAML
- [x] Prometheus + Grafana 설정
- [x] PR-Agent Gemini 자동 코드 리뷰
- [x] CI 테스트 환경 수정 (TestClient 전환, DB URL env 변수)
- [x] 브랜치 전략 README 반영 (develop → staging → main)
- [x] 커밋별 스택 PR 13개 생성
- [x] Git 히스토리 재구성 — 3 브랜치(feat/infra, feat/app, feat/tests), 브랜치당 다수 커밋, develop에 merge 완료
- [x] GitHub Actions CI fix — `alembic upgrade head` 스텝 추가 (`relation "courses" does not exist` 오류 수정)
- [x] PR Agent fix — `GOOGLE_AI_STUDIO_KEY` 환경변수 수정, `continue-on-error: true`, `auto_improve: false`
- [x] `entrypoint.sh` 복구 — Docker volume mount 환경에서 누락된 파일 복원

### 프론트엔드 (추가)

- [x] 패널 드래그 리사이즈 — lecture/notes/blog 3컬럼 크기 조절 + localStorage 저장 (CSS custom property + mousedown 이벤트)
