#!/usr/bin/env bash

set -o pipefail # FAIL FAST
scriptDir=$( cd -- "$( dirname -- "${BASH_SOURCE[0]}" )" &> /dev/null && pwd )
source $scriptDir/helpers.sh
shopt -s expand_aliases

confirm_aws_account

# Set the desired count of the service to the first argument; otherwisee, the service will be scaled to 2
DESIRED_COUNT=${1:-2}

echo "Deploying the backstage backend container";
# TODO: proper versioning for build tag CODEBUILD_RESOLVED_SOURCE_VERSION identifier tag
DATE_TAG=$(date -u +%Y%m%d-%H%M)
BACKSTAGE_IMAGE_NAME=$APP_NAME-backstage
docker tag $BACKSTAGE_IMAGE_NAME:latest $AWS_ACCOUNT_ID.dkr.ecr.$AWS_DEFAULT_REGION.amazonaws.com/$BACKSTAGE_IMAGE_NAME:$DATE_TAG
docker tag $BACKSTAGE_IMAGE_NAME:latest $AWS_ACCOUNT_ID.dkr.ecr.$AWS_DEFAULT_REGION.amazonaws.com/$BACKSTAGE_IMAGE_NAME:latest
aws ecr get-login-password --region $AWS_DEFAULT_REGION | docker login --username AWS --password-stdin $AWS_ACCOUNT_ID.dkr.ecr.$AWS_DEFAULT_REGION.amazonaws.com
docker push $AWS_ACCOUNT_ID.dkr.ecr.$AWS_DEFAULT_REGION.amazonaws.com/$BACKSTAGE_IMAGE_NAME:$DATE_TAG
docker push $AWS_ACCOUNT_ID.dkr.ecr.$AWS_DEFAULT_REGION.amazonaws.com/$BACKSTAGE_IMAGE_NAME:latest

echo "Updating the ECS service to start 2 tasks"
$scriptDir/update-backstage-service-count.sh $DESIRED_COUNT
