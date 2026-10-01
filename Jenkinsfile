pipeline {

    agent any

    environment {
        BACKEND_IMAGE = 'expense-management-saas-backend'
        FRONTEND_IMAGE = 'expense-management-saas-frontend'
    }

    stages {

        stage('Checkout') {
            steps {
                echo 'Checking out source code...'
                checkout scm
            }
        }

        stage('Backend Install') {
            steps {
                dir('server') {
                    sh 'npm ci'
                }
            }
        }

        stage('Frontend Install') {
            steps {
                dir('client') {
                    sh 'npm ci'
                }
            }
        }

        stage('Frontend Build') {
            steps {
                dir('client') {
                    sh 'npm run build'
                }
            }
        }

        stage('Build Backend Docker Image') {
            steps {
                sh '''
                    docker build \
                      -t ${BACKEND_IMAGE}:${BUILD_NUMBER} \
                      ./server
                '''
            }
        }

        stage('Build Frontend Docker Image') {
            steps {
                sh '''
                    docker build \
                      --build-arg VITE_API_URL=http://localhost:5000/api \
                      -t ${FRONTEND_IMAGE}:${BUILD_NUMBER} \
                      ./client
                '''
            }
        }

        stage('Trivy Security Scan') {
            steps {
                sh '''
                    docker run --rm \
                      -v /var/run/docker.sock:/var/run/docker.sock \
                      aquasec/trivy:latest image \
                      --severity HIGH,CRITICAL \
                      --exit-code 1 \
                      ${BACKEND_IMAGE}:${BUILD_NUMBER}
                '''

                sh '''
                    docker run --rm \
                      -v /var/run/docker.sock:/var/run/docker.sock \
                      aquasec/trivy:latest image \
                      --severity HIGH,CRITICAL \
                      --exit-code 1 \
                      ${FRONTEND_IMAGE}:${BUILD_NUMBER}
                '''
            }
        }
    }

    post {

        success {
            echo '======================================'
            echo 'CI PIPELINE PASSED'
            echo 'Docker images built successfully'
            echo 'Security scan passed'
            echo '======================================'
        }

        failure {
            echo '======================================'
            echo 'CI PIPELINE FAILED'
            echo 'Check the failed stage above'
            echo '======================================'
        }

        always {
            sh 'docker image prune -f || true'
        }
    }
}