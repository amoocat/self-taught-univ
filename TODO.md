# STU (Self-Taught University) — TODO & 고도화 플랜

> 이 파일은 Claude Code에서 자동으로 읽힘.
> 작업 완료 시 [ ] → [x] 로 바꿔줘.
> [x] 항목이 생기면 해당 섹션에서 제거하고 맨 아래 `## ✅ 완료된 것들` 섹션의 적절한 소제목 아래로 옮겨줘.

---

## 🔴 지금 (Phase 2 진행 중)

### AI 기능
- [ ] 노트 임베딩 생성 (pgvector) → 시맨틱 검색 (아래 Phase 3 참고)

### 크롤러 (Phase 1 잔여)
- [x] YouTube API 키 발급 후 `.env`에 추가
- [ ] YouTube Data API v3 연동 확인 — `POST /api/v1/crawl/youtube` 실제 실행 테스트 (서버 기동 후 직접 확인 필요)

### 형상 관리 (Phase 1 잔여)
- [x] 기존 init 커밋 삭제 후 기능별 9개 커밋으로 히스토리 재작성 (orphan 브랜치 방식)
- [x] 각 커밋 메시지에 기술적 동작 원리·설계 의도 초심자 수준으로 상세 기술
- [ ] 각 커밋마다 TODO.md의 완료 기능 표시도 커밋 내용에 맞게 수정 필요

### 강의 구성 고도화
> ⚠️ YouTube API 키 발급 완료 후 진행 가능
- [ ] `lectures` 테이블에 YouTube 필드 추가 — `youtube_video_id`, `thumbnail_url`, `playlist_id`, `order_index`, `is_available`
- [ ] YouTube Data API v3로 플레이리스트 일괄 import — video_id·title·duration·thumbnail 저장
- [ ] 프론트: `ll-item` 클릭 시 YouTube iframe embed로 재생 (`youtube_video_id` 기반)
- [ ] 배치: 주기적으로 영상 유효성 체크 → 삭제·비공개 시 `is_available = false` 처리
- [ ] 최신 동향 자동 크롤링 → 피드 페이지 통합 (Naver D2, 당근 테크, 테크 유튜브)
- [ ] 내 YouTube 플레이리스트 가져오기 (과목별 플리 URL 입력 → 강의 자동 import)
- [ ] 신규 강좌 추가 — TED 행복 강좌 (wellbeing 카테고리 신설)
- [ ] 신규 강좌 추가 — MLVU (바탕화면 폴더 영상 → 로컬 import 방식 결정 필요)

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

### 인프라
- [ ] minikube 로컬 K8s 배포 테스트
- [ ] Jenkins CI 파이프라인 실제 실행 테스트
- [ ] ArgoCD 설치 및 연동
- [ ] API 키 사용량 대시보드

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
> 지식 그래프의 노드(개념)를 텍스트로 변환해 임베딩 → 개념 간 유사도 계산

- [ ] 노드 텍스트화 전략 결정
  - 노드명 + 연결된 노드명들 + 해당 노트 요약을 합쳐서 임베딩
  - 예: `"Transformer: attention, self-attention, BERT, GPT, position encoding. 내 노트 요약: ..."`
- [ ] 그래프 노드 임베딩 생성: `app/services/graph_embedding_service.py`
- [ ] 노드 추가/수정 시 임베딩 자동 갱신
- [ ] (선택) Node2Vec / GraphSAGE 같은 그래프 전용 임베딩 도입 검토
  - 텍스트 임베딩으로 충분하면 스킵. 그래프 구조 자체를 학습시키고 싶을 때 도입.

### 3-4. 시맨틱 서치 API
- [ ] `GET /api/v1/search?q=&type=` — 통합 시맨틱 검색 엔드포인트
  - `type`: `all` / `notes` / `papers` / `lectures` / `concepts`
  - 쿼리 텍스트 → 임베딩 → pgvector cosine similarity 검색
  - 결과에 `similarity_score` 포함
- [ ] 하이브리드 서치 (선택): 키워드 검색(PostgreSQL FTS) + 시맨틱 검색 결과 RRF(Reciprocal Rank Fusion)로 합산
- [ ] 검색 결과를 프론트 검색바에 연결

### 3-5. RAG 기반 챗봇 고도화
> 현재 챗봇: Claude에게 질문만 던짐
> 목표: "내가 공부한 내용" 기반으로 Claude가 답변하도록

- [ ] 챗봇 질문 → 임베딩 → 유사 노트/논문/렉쳐 top-k 검색
- [ ] 검색된 문서를 Claude 프롬프트 컨텍스트에 주입
  ```
  [시스템]: 아래는 학생이 직접 작성한 노트와 논문 요약입니다.
  이를 참고해서 질문에 답하되, 학생이 아직 공부하지 않은 내용은
  "아직 이 부분은 공부 안 하셨네요" 라고 알려주세요.
  [컨텍스트]: {retrieved_docs}
  [질문]: {user_question}
  ```
- [ ] 답변에 출처 표시 (어떤 노트/논문에서 가져온 내용인지)
- [ ] 테스트 모드: "이 개념 설명해봐" → 내 노트와 대조해서 채점

### 3-6. 프론트 연결
- [ ] 통합 검색바 → 시맨틱 서치 API 연결
- [ ] 지식 그래프: 노드 클릭 시 "유사한 개념" 사이드패널 표시 (그래프 임베딩 유사도 활용)
- [ ] 노트 에디터: 작성 중 유사 노트/논문 자동 추천 (실시간 임베딩 유사도)
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

- [ ] 사주 챗봇 — 생년월일 입력 → 사주 해석 + Claude 대화 ("작년에 학업운이 좋았는데 맞죠?" 이런 느낌, 대답듣고 답변 수정및 고도화)
- [ ] 멘탈케어 MCP — 블로그 일기 읽고 페르소나 학습 → 맞춤형 멘탈케어 챗봇
- [ ] ETL 그래프 MCP — 데이터 파이프라인 구조 자동 시각화
- [ ] 포트폴리오 MCP — Obsidian 회사 기록 정리 → 포트폴리오 자동 구성
- [ ] 0원 챌린지 — 무료 티어 조합(Vercel + Railway + Supabase 등)으로 STU 운영 한계 탐색
- [ ] 대규모 트래픽 실험

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
- [x] 같이 논문 읽어주는 챗봇 — 논문 뷰어에 Q&A 패널 추가 (POST /chat/paper/{id}/stream, 논문 abstract·키워드 컨텍스트 주입)
- [x] 시험볼때 힌트 챗봇 — 강의 노트 컨텍스트 기반 단계적 힌트 제공 (POST /chat/lecture/{id}/stream, 슬라이드인 패널)
- [x] YouTube API 키 발급 — `.env`에 `YOUTUBE_API_KEY` / `YOUTUBE_OAUTH_CLIENT` 설정 완료, `.env.example`에 항목 추가
- [x] 형상관리 — 기능별 9개 커밋으로 히스토리 재작성, 각 커밋 메시지에 기술적 동작 원리 상세 기술
- [x] APScheduler 배치 크롤러
- [x] YouTube / arXiv / 블로그 크롤러
- [x] 크롤러 수동 테스트: `POST /api/v1/crawl/arxiv` (논문 23개 수집 확인)
- [x] 크롤러 수동 테스트: `POST /api/v1/crawl/blogs` (132개 피드 수집 확인)
- [x] 블로그 크롤러 ML/data 필터링 (개인·빅테크 전체 수집, 한국 테크 블로그는 키워드 필터)
- [x] Docker Compose 로컬 환경
- [x] alembic 마이그레이션
- [x] 저명 논문 8개 seed 완료
- [x] Dockerfile entrypoint에 `alembic upgrade head` 자동화
- [x] `.env.example` 파일 작성

### 인프라
- [x] K8s YAML (Deployment, Ingress, Storage)
- [x] Jenkinsfile CI 파이프라인
- [x] GitHub Actions CI
- [x] ArgoCD Application YAML
- [x] Prometheus + Grafana 설정