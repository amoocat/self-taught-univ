pipeline {
    agent any

    environment {
        IMAGE_NAME = "yourdockerhub/stu-api"
        IMAGE_TAG  = "${BUILD_NUMBER}"
        ARGOCD_APP = "stu-backend"
    }

    stages {
        stage("Checkout") {
            steps {
                checkout scm
            }
        }

        stage("Install & Test") {
            steps {
                sh """
                    python -m venv venv
                    . venv/bin/activate
                    pip install -r requirements.txt
                    pytest tests/ -v --tb=short --cov=app --cov-report=xml
                """
            }
            post {
                always {
                    junit "test-results/*.xml"
                    cobertura coberturaReportFile: "coverage.xml"
                }
            }
        }

        stage("Docker Build & Push") {
            when {
                branch "main"
            }
            steps {
                withCredentials([usernamePassword(
                    credentialsId: "dockerhub-creds",
                    usernameVariable: "DOCKER_USER",
                    passwordVariable: "DOCKER_PASS"
                )]) {
                    sh """
                        docker build -t ${IMAGE_NAME}:${IMAGE_TAG} .
                        docker tag ${IMAGE_NAME}:${IMAGE_TAG} ${IMAGE_NAME}:latest
                        echo "$DOCKER_PASS" | docker login -u "$DOCKER_USER" --password-stdin
                        docker push ${IMAGE_NAME}:${IMAGE_TAG}
                        docker push ${IMAGE_NAME}:latest
                    """
                }
            }
        }

        stage("Update K8s Manifests") {
            when {
                branch "main"
            }
            steps {
                // k8s/base/api-deployment.yaml 의 image 태그를 새 버전으로 업데이트
                sh """
                    sed -i "s|image: ${IMAGE_NAME}:.*|image: ${IMAGE_NAME}:${IMAGE_TAG}|g" \
                        k8s/base/api-deployment.yaml
                    git config user.email "jenkins@stu.local"
                    git config user.name  "Jenkins"
                    git add k8s/base/api-deployment.yaml
                    git commit -m "ci: bump image to ${IMAGE_TAG} [skip ci]" || true
                    git push origin main
                """
                // ArgoCD가 main 브랜치를 watching → 자동 sync
            }
        }

        stage("ArgoCD Sync (optional)") {
            when {
                branch "main"
            }
            steps {
                // ArgoCD CLI로 강제 sync (ArgoCD auto-sync 켜두면 생략 가능)
                withCredentials([string(credentialsId: "argocd-token", variable: "ARGOCD_TOKEN")]) {
                    sh """
                        argocd app sync ${ARGOCD_APP} \
                            --auth-token $ARGOCD_TOKEN \
                            --server argocd.stu.local \
                            --grpc-web || true
                    """
                }
            }
        }
    }

    post {
        failure {
            echo "빌드 실패! 슬랙/이메일 알림 추가 가능"
        }
        success {
            echo "배포 완료: ${IMAGE_NAME}:${IMAGE_TAG}"
        }
    }
}
