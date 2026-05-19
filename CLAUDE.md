# STU Backend 프로젝트

## 개요
Self-Taught University 백엔드. 개인 AI 학습 플랫폼.

## 스택
- FastAPI + SQLAlchemy 2.0 (async)
- PostgreSQL + pgvector (Supabase)
- Redis + Celery (백그라운드 잡)
- Docker → minikube K8s
- Jenkins CI + ArgoCD CD
- Prometheus + Grafana 모니터링

## AI 기능 관련 필수 규칙
- 챗봇, 주석 생성, 키워드 추출 등 **AI 기능은 반드시 GPT API (OpenAI) 사용**
- Claude/Anthropic API는 절대 사용하지 않음 (앱 코드 한정)

---

## Git 브랜치 전략 (반드시 준수)

### 브랜치 구조
```
main      ← 배포용. 직접 push 금지.
staging   ← QA용. develop에서 PR로만 merge.
develop   ← 개발 통합. feature/* PR의 대상.
feature/* ← 기능 개발. develop에서 분기.
```

### 작업 시작 전 필수 절차
```bash
# 1. develop 최신화
git checkout develop && git pull origin develop

# 2. feature 브랜치 생성 (develop 기준)
git checkout -b feat/기능명

# 3. 작업 후 PR 생성 (base: develop)
gh pr create --base develop
```

> ⛔ main에 직접 push 절대 금지  
> ⛔ develop에 직접 push 금지  
> ✅ 반드시 feature/* → develop PR → merge 순서

### 브랜치 네이밍
| 유형 | 형식 | 예시 |
|------|------|------|
| 기능 추가 | `feat/짧은-설명` | `feat/youtube-oauth` |
| 버그 수정 | `fix/짧은-설명` | `fix/arxiv-rate-limit` |
| 문서 | `docs/짧은-설명` | `docs/api-guide` |
| 리팩터링 | `refactor/짧은-설명` | `refactor/crawler` |
| 테스트 | `test/짧은-설명` | `test/crud-api` |
| 인프라 | `infra/짧은-설명` | `infra/k8s-deploy` |

### 커밋 메시지 규칙
```
타입: 한 줄 요약 (50자 이내)

- 변경한 파일별 주요 내용
- 왜 이렇게 구현했는지 (기술적 배경)
- 새 API 엔드포인트가 있다면 명시
```
타입: `feat` `fix` `docs` `refactor` `test` `infra` `chore`

### PR 본문 규칙
반드시 포함:
- **변경 파일별 구현 내용** + 기술적 세부사항 (왜 이렇게 했는지)
- **새 API 엔드포인트** 목록 (있는 경우)
- **테스트 방법** 체크리스트

---

## 세션 마무리 규칙
> 사용자가 별도로 요청하지 않아도 세션 마무리 시 자동 수행

1. **TODO.md 업데이트**: 완료 항목 `[x]` 처리 → `## ✅ 완료된 것들` 섹션으로 이동
2. **미커밋 변경사항 커밋**: 위 커밋 메시지 규칙 준수
3. **PR 생성**: 위 PR 본문 규칙 준수. base는 항상 `develop`
