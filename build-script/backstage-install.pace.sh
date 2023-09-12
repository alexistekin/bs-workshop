#!/usr/bin/env bash

biScriptDir=$( cd -- "$( dirname -- "${BASH_SOURCE[0]}" )" &> /dev/null && pwd )
appRootDir=$biScriptDir/..
backstageDir=$appRootDir/backstage

# install base backstage app
if [ ! -d "$backstageDir" ]; then
    echo "Installing Backstage app (using create-app version ${BACKSTAGE_CREATE_APP_VERSION})"
    BACKSTAGE_APP_NAME=backstage npx -y -q @backstage/create-app@${BACKSTAGE_CREATE_APP_VERSION} --path $backstageDir
else
    echo "Backstage app already exists.  Continuing..."
fi

# It is expected that the version identifier in each plugin's package.json will be
# a larger semver identifier than any version that is officially published to npm registry.
AWS_APPS_VERSION=$(cat $backstageDir/plugins/aws-apps/package.json | jq -r '.version')
AWS_APPS_BACKEND_VERSION=$(cat $backstageDir/plugins/aws-apps-backend/package.json | jq -r '.version')
AWS_APPS_DEMO_VERSION=$(cat $backstageDir/plugins/aws-apps-demo/package.json | jq -r '.version')
AWS_APPS_SCAFFOLDER_VERSION=$(cat $backstageDir/plugins/scaffolder-backend-module-aws-apps/package.json | jq -r '.version')

# Install backend dependencies
echo "Installing backend dependencies"
yarn --cwd $backstageDir/packages/backend add \
    "@roadiehq/catalog-backend-module-okta@^0.8.5" \
    "@roadiehq/scaffolder-backend-module-utils@^1.10.1" \
    "@immobiliarelabs/backstage-plugin-gitlab-backend@^6.0.0" \
    "@aws/plugin-aws-apps-backend-for-backstage@${AWS_APPS_BACKEND_VERSION}" \
    "@aws/plugin-scaffolder-backend-aws-apps-for-backstage@${AWS_APPS_SCAFFOLDER_VERSION}"

# Install frontend dependencies
echo "Installing frontend dependencies"
yarn --cwd $backstageDir/packages/app add \
    "@immobiliarelabs/backstage-plugin-gitlab@^6.0.0" \
    "@aws/plugin-aws-apps-for-backstage@${AWS_APPS_VERSION}" \
    "@backstage/plugin-home" \
    "@aws/plugin-aws-apps-demo-for-backstage@${AWS_APPS_DEMO_VERSION}"
