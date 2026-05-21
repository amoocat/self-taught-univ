# STU (Self-Taught University) — TODO & 고도화 플랜

> 이 파일은 Claude Code에서 자동으로 읽힘.
> 작업 완료 시 [ ] → [x] 로 바꿔줘.
> [x] 항목이 생기면 맨 아래 `## ✅ 완료된 것들` 섹션으로 이동해줘.

---

## 🔥 지금 할 것 (Current Sprint)

### 1. 커리큘럼 자동 구성 — 키워드 기반 v1

> VideoInbox/Lecture에 쌓인 영상들을 카테고리·키워드·난이도 기준으로
> 10~20개 챕터로 자동 구성. v2(LLM)는 이후에.

**백엔드**
- [ ] `app/services/curriculum_builder.py` 작성
  - `Chapter(title, keywords, difficulty, order)` 데이터클래스
  - `CHAPTER_DEFINITIONS` 상수 — 카테고리별 챕터 목록 + 매칭 키워드 + 난이도(1~3)
    - math: 벡터·행렬 기초 → 선형변환 → 고유값·SVD → 최적화 ...
    - ml: 지도학습 기초 → 트리·앙상블 → SVM → 군집화 → 차원축소 ...
    - dl: 신경망 기초 → CNN → RNN·LSTM → 최적화·정규화 → Autoencoder ...
    - nlp: 전처리·임베딩 → Seq2Seq → Attention → BERT → GPT ...
    - llm: 프롬프트 엔지니어링 → 파인튜닝 → RAG → 에이전트 ...
- [ ] 영상 → 챕터 매칭 로직 (제목+설명 키워드 점수, 1챕터 N영상 허용, 난이도 순 정렬)
- [ ] `POST /api/v1/curriculum/build?category=ml` — 카테고리별 커리큘럼 생성
- [ ] `POST /api/v1/curriculum/build-all` — 전체 카테고리 일괄 생성

**v2 — LLM 고도화 (나중에)**
- [ ] GPT에게 영상 목록 넘겨서 챕터 자동 생성 + 영상 배정
- [ ] 난이도 자동 추론, 선수지식 관계 그래프 자동 생성

---

### 2. AI 챗봇 / 노트 — 하드코딩 제거

- [ ] **렉쳐 노트 비어있음** — DB에 `LectureNote` 데이터 없음 (나중에 AI 자동 생성 예정)
- [ ] **컨텍스트 바 하드코딩** — 실제 강의 상태 반영 미구현
- [ ] **취약 개념 칩 하드코딩** — 동적 생성 미구현
- [ ] **그래프 데이터 fallback** — 노트 저장 후 자동 생성되므로 노트 데이터 필요

---

## 📺 YouTube 연동 — 추가 고도화

- [ ] 정기 동기화 — 이미 등록한 플리에 새 영상 추가됐을 때 자동 반영 (주 1회 배치)
- [ ] GPT 기반 플리 관련도 점수 — 플리 제목+설명으로 학습 관련도 점수 → 상단 정렬 (v2)

---

## 🤖 MCP 개발 (학습봇용) — 우선순위 순

- [ ] **1순위** STU 자체 MCP — 진도·노트·취약점 DB 조회
- [ ] **2순위** Brave 웹 검색 MCP — 모르는 개념 즉시 검색
- [ ] **3순위** arXiv MCP — 논문 검색·요약
- [ ] **4순위** YouTube MCP — 강의 검색
- [ ] **5순위** Obsidian MCP — 대화 내용 노트 자동 저장
- [ ] **6순위** 테크 블로그 크롤링 MCP — 기존 크롤러를 MCP 인터페이스로 래핑
- [ ] **7순위** Obsidian 링크 자동정리 MCP — 링크 붙여넣으면 요약·태그·노트 자동 생성
- [ ] **8순위** Gemini 파이프라인 MCP — 회사 Gemini로 논문·자료 요약 → Obsidian → STU
- [ ] **9순위** YouTube 시청기록 MCP — 시청 기록 기반 강의 진도율 자동 반영
- [ ] **10순위** 강의·논문·테크블로그 지식베이스 → RAG 챗봇 고도화

---

## 🔍 검색 기능

- [ ] `GET /api/v1/lectures/search?q=` + `GET /api/v1/notes/search?q=` 엔드포인트
- [ ] PostgreSQL `tsvector` 풀텍스트 또는 `ILIKE` 방식 결정
- [ ] 프론트 검색바 연동

---

## ☸️ 인프라 — Jenkins + ArgoCD 실제 연결

> `git push` → Jenkins (테스트 + Docker 빌드/push) → ArgoCD (k8s 배포)
> YAML은 이미 있음. 실제로 minikube 위에 올리는 작업만 남음.

- [ ] **Step 1** minikube 시작 + Ingress + ArgoCD 설치
- [ ] **Step 2** Jenkins Docker 실행 + 플러그인 설치
- [ ] **Step 3** Jenkins Credentials 등록 (dockerhub / argocd-token / github-token)
- [ ] **Step 4** Jenkinsfile `IMAGE_NAME`, `ARGOCD_SERVER` 실제 값으로 수정
- [ ] **Step 5** GitHub Webhook → Jenkins 연결
- [ ] **Step 6** ArgoCD Application 등록 (`kubectl apply -f argocd/app-dev.yaml`)
- [ ] **Step 7** 엔드투엔드 테스트 — push → Jenkins → ArgoCD sync → Pod 롤링업데이트 확인

---

## 🔵 Phase 3 — 벡터 임베딩 & RAG

> pgvector로 노트·논문·강의를 임베딩해서 시맨틱 검색과 RAG 챗봇 구현

- [ ] pgvector 임베딩 파이프라인 — 노트/논문/렉쳐 저장 시 자동 임베딩
  - 모델: `text-embedding-3-small` (OpenAI) 또는 `multilingual-e5-large` (로컬 추천)
- [ ] `GET /api/v1/search?q=&type=` — 통합 시맨틱 검색 (notes / papers / lectures / concepts)
- [ ] RAG 챗봇 — 질문 → top-k 유사 문서 검색 → GPT 컨텍스트 주입 → 출처 표시
- [ ] 지식 그래프 노드 임베딩 → "유사한 개념" 사이드패널

---

## 🟢 나중에 (Phase 4~7)

### 인프라 고도화
- [ ] Redis 제대로 활용 — API 캐싱, 챗봇 세션, 임베딩 캐시, Rate limiting
- [ ] MongoDB 도입 — 논문 전문 + 렉쳐 노트 본문 (PostgreSQL 메타 + MongoDB 본문)
- [ ] Kafka + Flink — 크롤러 이벤트 스트리밍, 실시간 추천

### 웹 로그 / 세션
- [ ] FastAPI 미들웨어 요청 로깅 (`session_id`, `event_type`, `path`, `properties`)
- [ ] `event_logs` 테이블 마이그레이션
- [ ] 프론트 클릭 이벤트 `POST /api/events`

### 기타
- [ ] API 키 사용량 대시보드
- [ ] DB·서버 클라우드 이관 (Supabase 유지 or 자체 호스팅)
- [ ] 웹사이트 대문 생성 (대학 홈페이지 스타일)
- [ ] 로그인 기능 — 유저별 커리큘럼
- [ ] 신규 강좌 — TED 행복 강좌 (wellbeing 카테고리)
- [ ] 신규 강좌 — MLVU (로컬 영상 import 방식 결정 필요)
- [ ] 0원 챌린지 — Vercel + Railway + Supabase 조합으로 운영
- [ ] 사주 챗봇, 멘탈케어 MCP, ETL 그래프 MCP, 포트폴리오 MCP

---

## ✅ 완료된 것들

### YouTube 연동 (이번 작업)
- [x] 플레이리스트 URL 직접 입력 — `GET /api/v1/youtube/playlist-meta`
- [x] 영상 URL 입력 → 채널 전체 플리 탐색 — `GET /api/v1/youtube/channel-playlists`
- [x] `get_video_channel`, `get_channel_playlists` 크롤러 메서드 추가
- [x] 좋아요 영상 기반 채널 자동 발견 — `GET /api/v1/youtube/discover` (페이징 + 더보기)
- [x] 내 플리 기반 채널 발견 — `source_playlist_id` 파라미터 (나중에 볼 영상 등)
- [x] 채널 플리 탐색 성능 개선 — `max_pages=1` (대형 채널 API 3회→1회)
- [x] 플리 모두 선택/해제 버튼
- [x] 등록됨 뱃지 — 이미 DB에 있는 플리 클라이언트 캐싱으로 표시
- [x] YouTube 플리 전체 → VideoInbox 무필터 저장 → 즉시 큐레이션 파이프라인
  - `VideoInbox` 모델 + migration 0007
  - `POST /playlists/sync` → inbox → `_promote_inbox_to_lectures()` 즉시 실행
  - `POST /inbox/curate` — 수동/LLM 교체용 진입점

### Phase 0 — 깨져있던 것들 수정
- [x] CHATGPT_API_KEY 미설정 해결
- [x] DB 초기 데이터 없음 — `seed.py` 자동 실행 (6과목 + 106강의)
- [x] 홈 대시보드 하드코딩 전부 API 동적 렌더링으로 교체
- [x] 노트 삭제 버튼, 논문 추가 UI, 논문 검색, 블로그 필터/탭/검색 동작
- [x] 지식 그래프 노드 클릭 무반응 수정

### Phase 2 — 강의/과목 고도화
- [x] `lectures` 스키마 YouTube 필드 추가 (`youtube_video_id`, `thumbnail_url`, `playlist_id`, `is_available`) + migration 0006
- [x] 강의 목록 썸네일·재생시간·완료 표시
- [x] 배치: 영상 유효성 체크 → 삭제·비공개 시 `is_available=false` (매주 화요일 4시)
- [x] `lectures` 태그/subtitle/prerequisites 필드 + GPT 자동 태깅 서비스
- [x] `_CATEGORY_RULES` 13개 카테고리 확장 + 신규 과목 6개 시드
- [x] YouTube 플리 가져오기 모달 개편 (2-step: 선택 → 필터 미리보기 → 저장)
- [x] 과목 상세 팝업 + `PATCH /curriculum/{id}` 편집 엔드포인트
- [x] 플리 accordion 확장 시 학습 관련 영상 미리보기
- [x] YouTube OAuth 2.0 인증 플로우 (token 자동 갱신)

### 프론트엔드
- [x] 프론트엔드 리팩토링 — `style.css` / `app.js` 분리
- [x] SPA 라우팅 (hash 기반), URL 파일명 숨기기
- [x] 모든 페이지 API 동적 렌더링 (홈/커리큘럼/강의/노트/논문/피드/그래프)
- [x] 내 노트 Obsidian 스타일 에디터 (CodeMirror + `[[링크]]`)
- [x] 패널 드래그 리사이즈 + localStorage 저장
- [x] GPT 챗봇 SSE 스트리밍 (학습/테스트/논문 Q&A 모드)

### 백엔드
- [x] FastAPI + SQLAlchemy 2.0 async 구조
- [x] SQLAlchemy ORM 모델 14개 테이블 (VideoInbox 포함)
- [x] CRUD API (notes, curriculum, chat, papers, feed, graph)
- [x] APScheduler 배치 (블로그 02:00, arXiv 02:30, YouTube 월 03:00)
- [x] YouTube / arXiv / 블로그 크롤러
- [x] pytest 37개 통합 테스트 (실 DB)
- [x] API 에러 핸들링 통일

### 인프라 (YAML 작성 완료 — 실제 연결은 위 ☸️ 섹션)
- [x] K8s YAML (Deployment, Ingress, Storage, kustomize overlay)
- [x] Jenkinsfile CI 파이프라인
- [x] GitHub Actions CI (develop·staging·main)
- [x] ArgoCD Application YAML
- [x] Prometheus + Grafana 설정
- [x] PR-Agent Gemini 자동 코드 리뷰
- [x] Docker Compose 로컬 환경 + entrypoint.sh
