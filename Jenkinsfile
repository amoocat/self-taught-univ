pipeline {
    agent any

    environment {
        IMAGE_NAME  = "yourdockerhub/stu-api"
        IMAGE_TAG   = "${BUILD_NUMBER}"
        ARGOCD_SERVER = "argocd.stu.local"
    }

    stages {

        stage("Checkout") {
            steps { checkout scm }
        }

        // 모든 브랜치: 테스트 항상 실행
        stage("Test") {
            steps {
                sh """
                    python -m venv venv
                    . venv/bin/activate
                    pip install -r requirements.txt -r requirements-dev.txt
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

        // develop / staging / main 브랜치만 빌드·배포
        stage("Docker Build & Push") {
            when {
                anyOf {
                    branch "main"
                    branch "staging"
                    branch "develop"
                }
            }
            steps {
                script {
                    // 환경별 이미지 태그 구분
                    def envTag = (env.BRANCH_NAME == "main") ? "${IMAGE_TAG}" :
                                 (env.BRANCH_NAME == "staging") ? "staging-${IMAGE_TAG}" :
                                 "dev-${IMAGE_TAG}"

                    withCredentials([usernamePassword(
                        credentialsId: "dockerhub-creds",
                        usernameVariable: "DOCKER_USER",
                        passwordVariable: "DOCKER_PASS"
                    )]) {
                        sh """
                            docker build -t ${IMAGE_NAME}:${envTag} .
                            echo "$DOCKER_PASS" | docker login -u "$DOCKER_USER" --password-stdin
                            docker push ${IMAGE_NAME}:${envTag}
                        """
                    }
                    env.DEPLOY_TAG = envTag
                }
            }
        }

        // K8s 매니페스트 이미지 태그 업데이트
        stage("Update Manifests") {
            when {
                anyOf {
                    branch "main"
                    branch "staging"
                    branch "develop"
                }
            }
            steps {
                script {
                    def overlay = (env.BRANCH_NAME == "main")    ? "prod"    :
                                  (env.BRANCH_NAME == "staging") ? "staging" : "dev"

                    sh """
                        sed -i "s|image: ${IMAGE_NAME}:.*|image: ${IMAGE_NAME}:${DEPLOY_TAG}|g" \
                            k8s/overlays/${overlay}/api-deployment.yaml
                        git config user.email "jenkins@stu.local"
                        git config user.name  "Jenkins CI"
                        git add k8s/overlays/${overlay}/api-deployment.yaml
                        git commit -m "ci(${overlay}): bump image to ${DEPLOY_TAG} [skip ci]" || true
                        git push origin ${env.BRANCH_NAME}
                    """
                }
            }
        }

        // ArgoCD 싱크 트리거 (auto-sync 켜두면 생략 가능)
        stage("ArgoCD Sync") {
            when {
                anyOf {
                    branch "main"
                    branch "staging"
                    branch "develop"
                }
            }
            steps {
                script {
                    def argoApp = (env.BRANCH_NAME == "main")    ? "stu-prod"    :
                                  (env.BRANCH_NAME == "staging") ? "stu-staging" : "stu-dev"

                    withCredentials([string(credentialsId: "argocd-token", variable: "ARGOCD_TOKEN")]) {
                        sh """
                            argocd app sync ${argoApp} \
                                --auth-token $ARGOCD_TOKEN \
                                --server ${ARGOCD_SERVER} \
                                --grpc-web || true
                        """
                    }
                }
            }
        }
    }

    post {
        failure { echo "빌드 실패 — 슬랙/이메일 알림 추가 가능" }
        success { echo "배포 완료: ${IMAGE_NAME}:${env.DEPLOY_TAG ?: 'test-only'}" }
    }
}
