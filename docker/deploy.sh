#!/bin/bash
echo "Starting up KPI"

REGION="us-east-1"
AWS_ACCOUNT=235216127026
NAMESPACE="kpi"
REGISTRY_URL=${AWS_ACCOUNT}.dkr.ecr.${REGION}.amazonaws.com
REPOSITORY_URI=${REGISTRY_URL}/${NAMESPACE}

sudo apt -y update
sudo apt -y install docker.io awscli

aws ecr get-login-password --region ${REGION} | docker login --username AWS --password-stdin ${REGISTRY_URL}

docker pull 235216127026.dkr.ecr.us-east-1.amazonaws.com/kpi:latest

docker run --rm --env-file /root/.env --name kpi -p 8000:8000 235216127026.dkr.ecr.us-east-1.amazonaws.com/kpi
