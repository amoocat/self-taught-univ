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

## 현재 상태 (Phase 1 완료)
- [x] 프로젝트 구조 생성
- [x] 모델 정의 (models.py)
- [x] CRUD 엔드포인트 (notes, curriculum, chat, papers, feed, graph)
- [x] Docker Compose 로컬 환경
- [x] K8s YAML (Deployment, Ingress, Storage)
- [x] Jenkinsfile + GitHub Actions CI
- [x] ArgoCD 설정
- [x] Prometheus + Grafana
- [x] alembic 마이그레이션
- [x] pytest 테스트 작성 (37개, 실 DB 대상)
- [x] 블로그 크롤러 ML/data 필터링

## 다음 할 것 (Phase 2)
- [ ] Claude API 실제 스트리밍 연결
- [ ] 각 강의 상세 페이지 (유튜브 플리 필터링 포함)
- [ ] YouTube API 키 발급 후 `.env`에 추가
- [ ] minikube 배포 테스트