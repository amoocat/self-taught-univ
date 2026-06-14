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

## PR 올리기 전 필수 체크

1. **`npm run build`** — `tsc --noEmit`만으로는 부족. 실제 빌드가 통과해야 함
2. **백엔드 문법 검사** — `python3 -m py_compile` 또는 서버 재시작 후 임포트 오류 없는지 확인
3. **dev 서버 재시작** — `pkill -f vite && npm run dev` 후 브라우저에서 CSS/스타일 정상 로드 확인
4. 수정한 페이지를 브라우저에서 직접 열어 동작 확인

**반면교사**: `tsc --noEmit`은 통과했지만 빌드에서 `Input`, `CardHeader`, `CardTitle` import 누락으로 실패한 채 PR을 올린 사례.

---

## 테스트 시 데이터 보호 원칙

**실제 운영 데이터에 DELETE/수정 curl을 직접 날리지 않는다.**

테스트가 필요할 때:
1. "테스트용 더미 데이터를 만들어서 할까요?" 라고 먼저 물어본다
2. 실제 데이터에 파괴적인 작업(DELETE, bulk delete 등)을 날리는 건 명시적으로 허락받고 한다

**반면교사**: bulk delete 속도 테스트를 위해 운영 DB의 실제 강좌 데이터를 curl로 직접 삭제해서 수십 개 강좌를 날린 사례.

---

## 구현 전 필수 확인 (관성 방지)

데이터 흐름이 복잡한 작업(삭제, 수정, 배치 처리 등)을 짜기 전에 반드시 먼저 확인:

> **"지금 내가 알고 있는 것은 뭐고, 원하는 결과는 뭔가?"**

- 알고 있는 것과 원하는 결과를 한 줄씩 쓰고 시작
- 기존 함수 재사용 여부가 불명확하면 관성으로 넘기지 말고 그 분기점을 명시적으로 꺼낼 것
- 흐릿한 부분은 구현 전에 사용자에게 보고하거나, 자연스러운 해법을 먼저 도출한 뒤 구현

**반면교사**: course ID 8개를 알고 있었는데, 기존 `_delete_lectures_by_ids()` 재사용을 위해
lecture ID 1400개를 먼저 SELECT → IN절에 전달하는 왕복을 만들었던 사례.
자연스러운 해법(`WHERE course_id IN (8개)` 서브쿼리)이 관성에 가려짐.

---

## 세션 마무리 규칙
> 사용자가 별도로 요청하지 않아도 세션 마무리 시 자동 수행

1. **TODO.md 업데이트**: 완료 항목 `[x]` 처리 → `## ✅ 완료된 것들` 섹션으로 이동
2. **미커밋 변경사항 커밋**: 위 커밋 메시지 규칙 준수
3. **PR 생성**: 위 PR 본문 규칙 준수. base는 항상 `develop`
