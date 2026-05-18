# STU Backend — 로컬 실행 가이드

## 1. 빠른 시작 (Docker Compose)

```bash
cp .env.example .env          # API 키 입력
docker compose up -d
# API: http://localhost:8000/docs
```

---

## 2. minikube 클러스터 세팅

```bash
# minikube 설치 후
minikube start --cpus=4 --memory=8192

# NGINX Ingress 활성화
minikube addons enable ingress

# /etc/hosts 에 추가
echo "$(minikube ip) stu.local" | sudo tee -a /etc/hosts

# 네임스페이스 생성
kubectl create namespace stu
```

---

## 3. 앱 배포

```bash
# Secret 설정 (API 키 등)
kubectl create secret generic stu-secrets \
  --from-literal=ANTHROPIC_API_KEY=your-key \
  --from-literal=SECRET_KEY=your-secret \
  -n stu

# 전체 배포
kubectl apply -f k8s/base/ -n stu

# 확인
kubectl get pods -n stu
kubectl get ingress -n stu
```

---

## 4. Jenkins 설치 (minikube)

```bash
helm repo add jenkins https://charts.jenkins.io
helm repo update
helm install jenkins jenkins/jenkins -n jenkins --create-namespace \
  --set controller.serviceType=NodePort

# 초기 비밀번호
kubectl exec -n jenkins -it svc/jenkins -c jenkins -- \
  /bin/cat /run/secrets/additional/chart-admin-password
```

---

## 5. ArgoCD 설치

```bash
kubectl create namespace argocd
kubectl apply -n argocd \
  -f https://raw.githubusercontent.com/argoproj/argo-cd/stable/manifests/install.yaml

# UI 접근
kubectl port-forward svc/argocd-server -n argocd 8080:443

# ArgoCD 앱 등록
kubectl apply -f k8s/argocd-app.yaml
```

---

## 6. Prometheus + Grafana 설치

```bash
helm repo add prometheus-community https://prometheus-community.github.io/helm-charts
helm repo update

helm install prometheus prometheus-community/kube-prometheus-stack \
  -n monitoring --create-namespace \
  -f monitoring/prometheus/values.yaml

# Grafana UI
kubectl port-forward svc/prometheus-grafana -n monitoring 3001:80
# 기본 계정: admin / prom-operator
```

---

## 7. 환경변수 예시 (.env.example)

```
DEBUG=true
SECRET_KEY=change-me-in-production
ANTHROPIC_API_KEY=sk-ant-...
DATABASE_URL=postgresql+asyncpg://stu:stu@localhost:5432/stu
REDIS_URL=redis://localhost:6379/0
ALLOWED_ORIGINS=http://localhost:3000
```

---

## API 구조

| 메서드 | 경로 | 설명 |
|--------|------|------|
| GET | /api/v1/curriculum/ | 전체 과목 + 진도율 |
| GET | /api/v1/curriculum/{id}/lectures | 강의 목록 |
| POST | /api/v1/curriculum/{id}/lectures/{lid}/complete | 완료 처리 |
| GET | /api/v1/notes/ | 내 노트 목록 |
| POST | /api/v1/notes/ | 노트 생성 |
| PUT | /api/v1/notes/{id} | 노트 수정 |
| DELETE | /api/v1/notes/{id} | 노트 삭제 |
| POST | /api/v1/chat/stream | AI 챗봇 (SSE 스트리밍) |
| GET | /api/v1/feed/ | 테크 블로그 피드 |
| GET | /api/v1/papers/ | 논문 목록 |
| POST | /api/v1/papers/{id}/annotate | 논문 AI 주석 생성 |
| GET | /api/v1/graph/ | 지식 그래프 노드+엣지 |
| GET | /metrics | Prometheus 메트릭 |
| GET | /healthz | 헬스체크 |
# PR-Agent Gemini 테스트
