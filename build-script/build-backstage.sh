#!/usr/bin/env bash

echo "Building the backstage app..."
bbScriptDir=$( cd -- "$( dirname -- "${BASH_SOURCE[0]}" )" &> /dev/null && pwd )
backstageDir=$bbScriptDir/../backstage
# cd $bbScriptDir/../backstage/
yarn --cwd  $backstageDir tsc
yarn --cwd  $backstageDir build:all
# yarn build-image
DOCKER_BUILDKIT=1
docker build . -f $bbScriptDir/../config/aws-production.Dockerfile --tag test-backstage
# cd -
echo "Backstage app build finished"