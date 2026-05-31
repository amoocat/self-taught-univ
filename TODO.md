# STU (Self-Taught University) — TODO & 고도화 플랜

> 이 파일은 Claude Code에서 자동으로 읽힘.
> 작업 완료 시 [ ] → [x] 로 바꿔줘.
> [x] 항목이 생기면 맨 아래 `## ✅ 완료된 것들` 섹션으로 이동해줘.

---

## 🛠️ 백엔드 API 품질 개선

- [ ] **Pydantic response 스키마 명시** — 현재 일부 엔드포인트가 `dict` 그대로 반환
- [ ] **JWT 인증 기초** — `POST /auth/login`, `POST /auth/refresh`, `get_current_user` 뼈대

---

## 🔥 지금 할 것 (Current Sprint)

### 🤖 에이전트 / AI 고도화
- [ ] **멀티에이전트 커리큘럼 검증** — Critic/Defender/Judge 에이전트가 토론해서 커리큘럼 품질 검증
  - `POST /api/v1/curriculum/validate` — 결과 JSON + 프론트 리포트
- [ ] **1인 데이터팀 멀티에이전트** — 크롤링·분류·요약을 각각 다른 에이전트가 담당
- [ ] **N8n 워크플로우** — 블로그 크롤링·논문 알림·강의 업데이트 자동화 파이프라인

### 🗺️ 지식 지도
- [ ] 지식 그래프 → 세계 지도로 완전 대체 여부 결정 (현재 둘 다 존재)

### 🎓 학교 페이지 고도화
- [ ] **홈 Hero 캠퍼스 슬라이드쇼** — MIT·Stanford·서울대·KAIST 사진 교차
- [ ] **Major / Degree 페이지** — Academics 탭에 전공 소개 + 이수 요건 추가

### 📚 콘텐츠
- [ ] **신규 강좌: LLM Engineering** — Udemy 강좌 추가
- [ ] **같이 논문읽기** — 논문 공동 주석 기능
- [ ] medium 계정 연동 크롤링
- [ ] 신규 강좌 — TED 행복 강좌, MLVU

### 🔧 개발/인프라
- [ ] **GitHub Webhook + Projects 연동**
- [ ] **develop → main 머지 + release 태그** — 첫 릴리즈

### 커리큘럼 자동 구성 — 키워드 기반 v1
- [ ] `app/services/curriculum_builder.py` — CHAPTER_DEFINITIONS + 영상 매칭 로직
- [ ] `POST /api/v1/curriculum/build?category=` + `build-all`

### AI 챗봇 / 노트 — 하드코딩 제거
- [ ] **렉쳐 노트 비어있음** — AI 자동 생성 예정
- [ ] **컨텍스트 바 하드코딩** — 실제 강의 상태 반영
- [ ] **취약 개념 칩** — 동적 생성

---

## 🤖 MCP 개발 (학습봇용) — 우선순위 순

- [ ] **1순위** STU 자체 MCP — 진도·노트·취약점 DB 조회
- [ ] **2순위** Brave 웹 검색 MCP
- [ ] **3순위** arXiv MCP — 논문 검색·요약
- [ ] **4순위** YouTube MCP — 강의 검색
- [ ] **5순위** Obsidian MCP — 대화 내용 노트 자동 저장
- [ ] **6순위** 테크 블로그 크롤링 MCP
- [ ] **7순위** Obsidian 링크 자동정리 MCP
- [ ] **8순위** Gemini 파이프라인 MCP — 논문·자료 → Obsidian → STU
- [ ] **9순위** YouTube 시청기록 MCP
- [ ] **10순위** 강의·논문·블로그 → RAG 챗봇 고도화

---

## 🔍 검색 고도화
- [ ] `tsvector` 풀텍스트 인덱스 (현재 ILIKE → 성능 개선)

---

## ☸️ 인프라 — Jenkins + ArgoCD 실제 연결

- [ ] Step 1 ~ 7 (minikube, Jenkins, Credentials, Jenkinsfile, Webhook, ArgoCD, E2E 테스트)

---

## 🔵 Phase 3 — 벡터 임베딩 & RAG

- [ ] pgvector 임베딩 파이프라인
- [ ] 시맨틱 검색 (ILIKE → 벡터 유사도)
- [ ] RAG 챗봇 — 출처 표시
- [ ] 그래프 노드 임베딩 → "유사한 개념" 사이드패널

---

## 🟢 나중에 (Phase 4~7)

- [ ] Redis 캐싱·Rate limiting
- [ ] MongoDB — 논문 전문 + 렉쳐 노트 본문
- [ ] Kafka + Flink — 크롤러 이벤트 스트리밍
- [ ] FastAPI 미들웨어 요청 로깅 + event_logs 테이블
- [ ] API 키 사용량 대시보드
- [ ] 로그인 기능 — 유저별 커리큘럼
- [ ] 0원 챌린지 — Vercel + Railway + Supabase
- [ ] 사주 챗봇, 멘탈케어 MCP, ETL 그래프 MCP, 포트폴리오 MCP

---

## ✅ 완료된 것들

### MyPage 고도화
- [x] **학생 카드** — 학번·전공·진도·최근활동·AI점수, 지식그래프/세계지도 버튼
- [x] **공부 잔디 (세로형)** — 학생 카드 아래 16주 세로 히트맵 배치
- [x] **스터디 트래커** — 연속학습일·최장연속·총완료·총학습시간·주간목표 링·최근활동 피드
- [x] `GET /curriculum/heatmap` — 365일 날짜별 완료 수
- [x] `GET /curriculum/stats` — streak·총완료·총분·이번주·오늘·최근5개

### 지식 세계 지도
- [x] `/world-map` 신규 페이지 — SVG 대륙 8개, 진도에 따라 컬러/안개, 개념 도시 dot
- [x] 대륙 클릭 → 사이드 패널 (개념 도시 목록, 관련 강좌, 진도 바)
- [x] Course Catalog 하단 진입 배너

### 버그 수정 / UX 개선
- [x] 논문 페이지 새로고침 시 기존 주석 자동 로드
- [x] 지식 그래프 노드 클릭 상세 패널 (연결 개념 칩, 출처, 추가일)
- [x] 그래프 노드 생성: YouTube 태그 → GPT 학문 개념 추출 + rule-based fallback
- [x] `DELETE /graph/nodes/cleanup` + `POST /graph/from-course/{id}/completed`

### API 품질 개선
- [x] **페이지네이션** — notes/curriculum/lectures `?limit=&offset=`
- [x] **API 에러 통일** — HTTPException + unhandled → `{"error":"...","detail":"..."}`
- [x] **통합 검색** — `GET /api/v1/search/?q=&type=` (강의·노트·논문 ILIKE)
- [x] 개별 검색 파라미터 — notes/curriculum/lectures `?q=`

### React 전환 + AI 기능
- [x] 바닐라 JS frontend/ 전체 삭제 → React 완전 전환
- [x] Admissions / Campus Life 페이지
- [x] 모든 페이지 hero 스타일 통일 (CourseCatalog 기준)
- [x] 플로팅 AI 챗봇 — 학습/테스트 모드, SSE 스트리밍, 하단 pill 버튼
- [x] 강의 AI 힌트 패널 — 우측 슬라이드인, 강의 내용 기반
- [x] 논문 AI 키워드 주석 패널 + Q&A 챗
- [x] 지식 그래프 AI 노드 생성 버튼
- [x] 지식 그래프 모던 리디자인 — pill 카드, 베지어 엣지, 카테고리 필터, MiniMap
- [x] 강의 완료 → 그래프 노드 자동 등록 (`POST /graph/from-lecture/{id}`)
- [x] 노트 태그 표시
- [x] api.ts SSE 헬퍼 + 신규 API 메서드들
- [x] 웹사이트 대문 (EduPrime University React 앱)

### YouTube 연동
- [x] 정기 동기화 (일 1회 배치)
- [x] GPT 기반 플리 자동 선별
- [x] YouTube OAuth 에러 정비
- [x] 커리큘럼 자동 재구성 (`reorganize_courses`)
- [x] 플레이리스트 URL 직접 입력 / 채널 탐색 / 좋아요 기반 발견
- [x] VideoInbox → 즉시 큐레이션 파이프라인

### 강의 메타데이터·그래프 고도화
- [x] `published_at` 컬럼 + YouTube API 백필 (282개)
- [x] `meta_source` 컬럼 + GPT 자동 태깅
- [x] 전체 350개 강의 module_name + difficulty 직접 배정
- [x] `POST /graph/generate` — GPT 개념 노드 최대 50개
- [x] `POST /graph/from-lecture/{id}` — 강의 완료 시 개념 자동 등록

### 백엔드 기반
- [x] FastAPI + SQLAlchemy 2.0 async
- [x] ORM 모델 14개 테이블
- [x] CRUD API + APScheduler 배치
- [x] YouTube / arXiv / 블로그 크롤러
- [x] pytest 37개 통합 테스트

### 인프라 (YAML 완료)
- [x] K8s YAML, Jenkinsfile, GitHub Actions, ArgoCD, Prometheus+Grafana, Docker Compose
