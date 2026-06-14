# STU (Self-Taught University) — TODO & 고도화 플랜

> 이 파일은 Claude Code에서 자동으로 읽힘.
> 작업 완료 시 [ ] → [x] 로 바꿔줘.
> [x] 항목이 생기면 맨 아래 `## ✅ 완료된 것들` 섹션으로 이동해줘.

---

## 🔒 보안 / 퍼블릭 오픈 전 필수

- [ ] **Rate Limiting** — AI 엔드포인트 IP당 분 10회 (`slowapi`)
- [ ] **최소 API 인증** — `X-API-Key` 헤더 또는 `DEBUG=False` 외부 차단
- [ ] **`.env.example`** — `CHANGE_ME` 경고 추가

---

## 🔥 지금 할 것 (Current Sprint)

### 🎓 인증 / 학교 페이지
- [ ] **JWT 인증** — `POST /auth/register`, `/auth/login`, `/auth/refresh` + User 테이블 (전공·학위·가입일)
- [ ] **Admissions 신청 페이지** — `/admissions/apply`: 전공 선택 + 학위 과정 + 주당 목표 → 해당 전공 강좌 자동 enrolled
- [ ] **학생증 강화** — My Page: 학번·입학일·전공·학위·학년(진도 기반) + PDF 다운로드

### 🤖 MCP / AI
- [ ] **콘텐츠 자동 요약 MCP** (2순위)
  - 툴 3개: `get_unsummarized_content` / `summarize_content` / `get_content_summary`
  - 대상: 강좌, 블로그(`feed_items`), 논문(`papers`)
  - DB: `courses.summary`, `feed_items.summary`, `papers.ai_summary` 컬럼 추가
  - 슬래시 명령 `/stu-summarize`
- [ ] **Brave 웹 검색 MCP** (3순위)

### 🛠️ 백엔드 정리
- [ ] `jobs/tasks.py` + `crawlers/scheduler.py` 통합
- [ ] 서버 로깅 설정 (`logging.basicConfig`)

### 📚 콘텐츠
- [ ] 신규 강좌: LLM Engineering (Udemy)
- [ ] 신규 강좌: TED 행복 강좌, MLVU
- [ ] Medium 계정 연동 크롤링

### 🗺️ 기타
- [ ] 지식 그래프 vs 세계 지도 — 중복 여부 결정
- [ ] `tsvector` 풀텍스트 인덱스 (ILIKE → 성능 개선)

---

## 🔵 Phase 3 — 벡터 임베딩 & RAG

- [ ] pgvector 임베딩 파이프라인
- [ ] 시맨틱 검색
- [ ] RAG 챗봇 — 출처 표시
- [ ] 그래프 노드 임베딩 → "유사한 개념" 사이드패널

---

## 🟢 나중에

- [ ] Redis 캐싱
- [ ] Kafka + Flink 크롤러 스트리밍
- [ ] GitHub Webhook + Projects 연동
- [ ] Jenkins + ArgoCD 실제 연결
- [ ] 로그인 → 유저별 커리큘럼
- [ ] 0원 챌린지 (Vercel + Railway + Supabase)

---

## ✅ 완료된 것들

### 강좌 관리 고도화
- [x] **강좌 관리 페이지** (`/my-courses`) — 검색(서버사이드), 편집 모드, 일괄 삭제, 이름 수정, 진도 초기화
- [x] **강좌 카탈로그 Enroll** — "내 강좌" 버튼으로 등록/해제, `is_enrolled` 컬럼 (migration 0013)
- [x] **My Page / 강좌 관리 동기화** — 둘 다 `enrolled=true` 필터로 통일
- [x] **강좌 삭제 FK 수정** — `PaperAnnotation` 포함 연관 레코드 bulk DELETE로 처리
- [x] **`POST /curriculum/bulk` DELETE** — 여러 강좌 한 트랜잭션 삭제
- [x] **진도 초기화** — `POST /curriculum/{id}/reset-progress`
- [x] **강좌 수정** — `PATCH /curriculum/{id}` 제목·카테고리·출처 수정

### 강의 플레이어
- [x] **Skilljar 스타일 플레이어** — 좌측 사이드바 + 비디오 + 탭(노트/강의정보) + 이전/다음 네비

### 리팩토링
- [x] `youtube.py` 분리 → `youtube_oauth.py` / `youtube_playlists.py`
- [x] `models/models.py` → 도메인별 분리 (facade 유지)
- [x] `chat.py` 프롬프트 → `core/prompts.py`

### MyPage 고도화
- [x] 학생 카드, 공부 잔디, 스터디 트래커
- [x] `GET /curriculum/heatmap` + `/stats`

### 지식 세계 지도
- [x] `/world-map` SVG 대륙, 진도 컬러, 개념 도시

### API 품질
- [x] 페이지네이션, 에러 통일, 통합 검색
- [x] Pydantic response 스키마

### React + AI
- [x] 바닐라 JS → React 전환
- [x] 플로팅 AI 챗봇 (학습/테스트 모드, SSE)
- [x] 강의 AI 힌트 패널, 논문 AI 주석
- [x] 지식 그래프 리디자인

### YouTube 연동
- [x] OAuth, 동기화, GPT 분류, VideoInbox 파이프라인

### 백엔드 기반
- [x] FastAPI + SQLAlchemy 2.0 async, ORM 14테이블
- [x] pytest 37개, K8s/Jenkins/ArgoCD YAML
