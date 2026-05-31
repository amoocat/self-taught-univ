# STU (Self-Taught University) — TODO & 고도화 플랜

> 이 파일은 Claude Code에서 자동으로 읽힘.
> 작업 완료 시 [ ] → [x] 로 바꿔줘.
> [x] 항목이 생기면 맨 아래 `## ✅ 완료된 것들` 섹션으로 이동해줘.

---

## 🛠️ 백엔드 API 품질 개선

- [ ] **Pydantic response 스키마 명시** — 현재 일부 엔드포인트가 `dict` 그대로 반환. `response_model=` 전부 붙이기
- [ ] **JWT 인증 기초** — `POST /auth/login`, `POST /auth/refresh`, 미들웨어 `get_current_user` 뼈대만

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

---

## 📺 YouTube 연동 — 추가 고도화

- [ ] medium 계정도 연동해서 관심 및 구독중인 포스팅 크롤링하기

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

- [ ] `tsvector` 풀텍스트 인덱스로 성능 개선 (현재 ILIKE → 추후 전환)

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
- [ ] 시맨틱 검색 — ILIKE를 벡터 유사도 검색으로 교체
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
- [ ] 로그인 기능 — 유저별 커리큘럼
- [ ] 신규 강좌 - 카카오톡 나에게 보내는 톡도 긁어오기
- [ ] 신규 강좌 — TED 행복 강좌 (wellbeing 카테고리)
- [ ] 신규 강좌 — MLVU (로컬 영상 import 방식 결정 필요)
- [ ] 0원 챌린지 — Vercel + Railway + Supabase 조합으로 운영
- [ ] 사주 챗봇, 멘탈케어 MCP, ETL 그래프 MCP, 포트폴리오 MCP

---

## ✅ 완료된 것들

### API 품질 개선
- [x] **페이지네이션** — 강의/노트/커리큘럼 목록에 `?limit=&offset=` 추가
- [x] **API 에러 응답 통일** — HTTPException + unhandled 전부 `{"error": "...", "detail": "..."}` 포맷으로 통일
- [x] **전역 검색 엔드포인트** — `GET /api/v1/search?q=&type=` (강의·노트·논문 통합, ILIKE)
- [x] `GET /api/v1/notes/?q=` + `GET /api/v1/curriculum/?q=` + `GET /api/v1/curriculum/{id}/lectures?q=` 개별 검색
- [x] 네비바 검색창 연동 (300ms debounce, 드롭다운, 클릭 시 해당 페이지 이동)

### React 전환 + AI 기능 완성
- [x] **바닐라 JS frontend/ 전체 삭제** — React(frontend-react/)로 완전 전환
- [x] **Admissions 페이지** — 입학 자격·절차·개설과목, CourseCatalog 기준 hero 통일
- [x] **Campus Life 페이지** — Georgia Tech 구조 참고, Essentials 카드·타임라인·Advantage 블록
- [x] **모든 페이지 hero 스타일 통일** — CourseCatalog 기준 (`py-6`, 중앙 정렬, gradient)
- [x] **MyPage 학생 카드** — 좌측 sticky 패널 (학번·전공·진도·최근활동·AI점수)
- [x] **플로팅 AI 챗봇** — 학습/테스트 모드, 과목 선택, SSE 스트리밍, 하단 중앙 pill 버튼
- [x] **강의 AI 힌트 패널** — 우측 슬라이드인, 강의 내용 기반 단계적 힌트 (`/chat/lecture/{id}/stream`)
- [x] **논문 AI 키워드 주석 패널** — Sparkles 버튼 → 키워드별 해설 (`/papers/{id}/annotate`)
- [x] **논문 Q&A 챗** — 논문 컨텍스트 기반 SSE 스트리밍 (`/chat/paper/{id}/stream`)
- [x] **지식 그래프 AI 노드 생성 버튼** — `POST /graph/generate` 연결
- [x] **지식 그래프 모던 리디자인** — pill 카드 노드, 베지어 엣지, 카테고리 필터 바, MiniMap, 드래그 가능
- [x] **강의 완료 → 그래프 노드 자동 등록** — `POST /graph/from-lecture/{id}` 신규 엔드포인트
- [x] **노트 태그 표시** — MyPage 노트 탭에 `#태그` 칩 렌더링
- [x] **api.ts SSE 스트리밍 헬퍼** — `streamSSE()` 공통 유틸 + 신규 API 메서드들
- [x] 웹사이트 대문 생성 (대학 홈페이지 스타일) — EduPrime University React 앱으로 구현
- [x] 프론트 UI 강의 구조 반영 — 모듈 아코디언 첫 번째 자동 펼침 + 강의 아이템 난이도 배지
- [x] 사이드바 "나의 전공" [과목][모듈] 탭 분리 — 탭 클릭으로 접기/펼치기 + 모듈탭 난이도 도트

### YouTube 연동
- [x] 정기 동기화 — 이미 등록한 플리에 새 영상 추가됐을 때 자동 반영 (일 1회 배치)
- [x] GPT 기반 플리 자동 선별 — discover 결과를 GPT-4o-mini에 넘겨 자동 선택
- [x] YouTube OAuth 에러 응답 정비 — `invalid_grant` 감지 시 토큰 자동 삭제 + HTTP 401 통일
- [x] 신규 영상 추가 후 커리큘럼 자동 재구성 (`reorganize_courses`)
- [x] 플레이리스트 URL 직접 입력 — `GET /api/v1/youtube/playlist-meta`
- [x] 영상 URL 입력 → 채널 전체 플리 탐색
- [x] 좋아요 영상 기반 채널 자동 발견
- [x] 내 플리 기반 채널 발견
- [x] 플리 모두 선택/해제 버튼, 등록됨 뱃지
- [x] YouTube 플리 전체 → VideoInbox 무필터 저장 → 즉시 큐레이션 파이프라인

### 렉쳐 뷰 + 노트 + 커리큘럼 고도화
- [x] video_inbox 삭제 시 varchar=uuid 타입 오류 수정
- [x] GPT 쿼터 초과 시 키워드 분류 폴백 추가
- [x] 렉쳐 뷰 인라인 노트 에디터 + 마크다운 미리보기 탭
- [x] 커리큘럼 재정렬 스크립트 v2 — 109개 강의 재분류

### 강의 메타데이터 고도화
- [x] `lectures.published_at` 컬럼 추가 + YouTube API 백필 (282개)
- [x] `lectures.meta_source` 컬럼 추가 + GPT 자동 태깅 서비스
- [x] 전체 350개 강의 module_name + difficulty 직접 배정

### 지식 그래프 고도화
- [x] `POST /api/v1/graph/generate` — GPT-4o-mini 개념 노드 최대 50개 추출
- [x] `graph_nodes.has_content` 플래그
- [x] `POST /api/v1/graph/from-lecture/{id}` — 강의 완료 시 tags → GraphNode 자동 등록

### 백엔드 기반
- [x] FastAPI + SQLAlchemy 2.0 async 구조
- [x] SQLAlchemy ORM 모델 14개 테이블
- [x] CRUD API (notes, curriculum, chat, papers, feed, graph, search)
- [x] APScheduler 배치 (블로그 02:00, arXiv 02:30, YouTube 월 03:00)
- [x] YouTube / arXiv / 블로그 크롤러
- [x] pytest 37개 통합 테스트

### 인프라 (YAML 작성 완료 — 실제 연결은 위 ☸️ 섹션)
- [x] K8s YAML (Deployment, Ingress, Storage, kustomize overlay)
- [x] Jenkinsfile CI 파이프라인
- [x] GitHub Actions CI (develop·staging·main)
- [x] ArgoCD Application YAML
- [x] Prometheus + Grafana 설정
- [x] PR-Agent Gemini 자동 코드 리뷰
- [x] Docker Compose 로컬 환경 + entrypoint.sh
