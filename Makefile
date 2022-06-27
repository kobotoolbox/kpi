.PHONY: pip_compile

REGION="us-east-1"
NAMESPACE="kpi"
ENVIRONMENT="dev"
REGISTRY_URL=${AWS_ACCOUNT}.dkr.ecr.${REGION}.amazonaws.com
APP_NAME=kpi
APP_PATH="."
REPOSITORY_URI=${REGISTRY_URL}/${NAMESPACE}

PIP_DEPENDENCY_DIR=dependencies/pip
PIP_DEPENDENCY_SOURCES=$(wildcard $(PIP_DEPENDENCY_DIR)/*.in)
PIP_DEPENDENCY_TARGETS=$(PIP_DEPENDENCY_SOURCES:.in=.txt)

include Makefile.helper

pip_compile: $(PIP_DEPENDENCY_TARGETS)

# All `pip` dependency files depend on their corresponding `.in` file and the base `requirements.in`.
$(PIP_DEPENDENCY_DIR)/%.txt: $(PIP_DEPENDENCY_DIR)/%.in $(PIP_DEPENDENCY_DIR)/requirements.in
	CUSTOM_COMPILE_COMMAND='make pip_compile' pip-compile --output-file=$@ ${ARGS} $<


version:
	@echo "Version: ${APP_NAME}:${APP_VERSION}"
docker-login:
	@aws ecr get-login-password --region ${REGION} --profile veritree | docker login --username AWS --password-stdin ${REGISTRY_URL}
docker-build:
	@echo "Building Docker image ${APP_NAME}:${IMAGE_TAG} ECR: ${REPOSITORY_URI}..."
	@docker build -f ${APP_PATH}/Dockerfile -t ${APP_NAME}:${IMAGE_TAG} ${APP_PATH}
docker-push: docker-login
	@echo "Pushing Docker Image ${APP_NAME}:${IMAGE_TAG} to ${REPOSITORY_URI}..."
	@docker tag ${APP_NAME}:${IMAGE_TAG} ${APP_NAME}:latest
	@docker tag ${APP_NAME}:${IMAGE_TAG} ${REPOSITORY_URI}:${IMAGE_TAG}
	@docker tag ${APP_NAME}:${IMAGE_TAG} ${REPOSITORY_URI}:latest
	@docker push ${REPOSITORY_URI}:${IMAGE_TAG}
	@docker push ${REPOSITORY_URI}:latest
docker: docker-login docker-build docker-push
docker-run:
	@echo "Running Docker container ${APP_NAME}:${IMAGE_TAG}"
	@docker run -it --rm ${APP_NAME}:${IMAGE_TAG}
helm-dryrun:
	@echo "Deploying Helm Chart version in Kubernetes..."
	@helm upgrade ${APP_NAME} ${HELM_DIR} --version ${APP_VERSION} -n ${NAMESPACE} --cleanup-on-fail --debug --dry-run --install --atomic --wait --set image.tag=${IMAGE_TAG} --values=${HELM_DIR}/values/${ENVIRONMENT}.yaml
helm-upgrade:
	@echo "Deploying Helm Chart version in Kubernetes..."
	@helm upgrade ${APP_NAME} ${HELM_DIR} --version ${APP_VERSION} -n ${NAMESPACE} --install --wait --set image.tag=${IMAGE_TAG} --values=${HELM_DIR}/values/${ENVIRONMENT}.yaml
helm-template:
	@echo "Template Helm Chart version in Kubernetes ${HELM_DIR}/values/${ENVIRONMENT}.yaml..."
	@helm template ${APP_NAME} ${HELM_DIR} --debug --version ${APP_VERSION} -n ${NAMESPACE} --values=${HELM_DIR}/values/${ENVIRONMENT}.yaml --set image.tag=${IMAGE_TAG}
helm-rollback:
	@echo "Rollback Helm Chart version in Kubernetes..."
	@helm rollback ${APP_NAME} ${APP_VERSION} -n ${NAMESPACE}
helm-uninstall:
	@echo "Rollback Helm Chart version in Kubernetes..."
	@helm uninstall ${APP_NAME} -n ${NAMESPACE}
