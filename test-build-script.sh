#!/bin/bash

# Define the parameter locations
SSM_GITLAB_URL_lookup="/aad/gitlab-url"
SECRET_GITLAB_CONFIG_PROP_apiToken_lookup="/aad/remoteVars/at/SECRET_GITLAB_CONFIG_PROP_apiToken"

# Get the GitLab URL from SSM Parameter Store
SSM_GITLAB_URL=$(aws ssm get-parameter --name "$SSM_GITLAB_URL_lookup" --query "Parameter.Value" --output text)

# Get the GitLab API token from SSM Parameter Store
# SECRET_GITLAB_CONFIG_PROP_apiToken=$(aws ssm get-parameter --name "$SECRET_GITLAB_CONFIG_PROP_apiToken_lookup" --with-decryption --query "Parameter.Value" --output text)
SECRET_GITLAB_CONFIG_PROP_apiToken="KGt2I6JLUf39ctPUu7I7EUTwM"
# Get the AWS account ID
AWS_ACCOUNT_ID=$(aws sts get-caller-identity --query "Account" --output text)

# Print the values for verification
echo "SSM_GITLAB_URL: $SSM_GITLAB_URL"
echo "SECRET_GITLAB_CONFIG_PROP_apiToken: $SECRET_GITLAB_CONFIG_PROP_apiToken"
echo "AWS_ACCOUNT_ID: $AWS_ACCOUNT_ID"



###########
# This file will attempt to create a repo and if it can't it will still 
# push backstage-reference to your gitlab repo
###########
echo "Pushing the reference repository to Gitlab - $SSM_GITLAB_URL"
scriptDir=$( cd -- "$( dirname -- "${BASH_SOURCE[0]}" )" &> /dev/null && pwd )
appDir=$scriptDir/..

# Check to see if the gitlab url is using SSL.  If not, then exit and inform the user that they will need to push the reference repo manually
if [[ "$SSM_GITLAB_URL" =~ ^http:.*  ]]; then
    echo "Gitlab URL is not using SSL.  Please push the reference repo manually."
    exit 1
fi
 
GITLAB_TOKEN=$SECRET_GITLAB_CONFIG_PROP_apiToken

# Try to create a new project if one doesn't exist (will fail through)
# curl -H "Content-Type:application/json" "$SSM_GITLAB_URL/api/v4/projects?private_token=$GITLAB_TOKEN" -d "{ \"name\": \"backstage-reference\" ,  \"visibility\": \"internal\" }"

# Clean the temp directory if it exists to start from a blank slate
if [ -d "$appDir/git-temp" ]; then
  rm -rf $appDir/git-temp
fi
# Make tmp directory to add files that will be comitted to repo
mkdir -p $appDir/git-temp
echo -e "\nCloning from https://$SSM_GITLAB_HOSTNAME/aad-admin/backstage-reference.git\n"
git -C $appDir/git-temp clone -q "https://oauth2:$GITLAB_TOKEN@$SSM_GITLAB_HOSTNAME/aad-admin/backstage-reference.git"

# copy files to temp git repo
rsync -a --delete --exclude='**/node_modules' --exclude='**/cdk.out' --exclude='**/.git' $appDir/backstage-reference/ $appDir/git-temp/backstage-reference
rsync -a --delete --exclude='**/node_modules' --exclude='**/cdk.out' $appDir/iac/roots/{aad-common-constructs,aad-ecs-environment,aad-eks-environment,aad-serverless-environment} $appDir/git-temp/backstage-reference/environments
\cp $appDir/iac/roots/package.json $appDir/git-temp/backstage-reference/environments


cd $appDir/git-temp/backstage-reference;

# Replace variable placeholders with env specific information
if [[ "$OSTYPE" == "darwin"* ]]; then
    find . -type f -name "*.yaml" -exec sed -i "" "s/{{ *gitlab_hostname *}}/$SSM_GITLAB_HOSTNAME/g" {} +; 
    find . -type f -name "*.yaml" -exec sed -i "" "s/{{ *aws-account *}}/$AWS_ACCOUNT_ID/g" {} +; 
else
    find . -type f -name "*.yaml" -exec sed -i "s/{{ *gitlab_hostname *}}/$SSM_GITLAB_HOSTNAME/g" {} +; 
    find . -type f -name "*.yaml" -exec sed -i "s/{{ *aws-account *}}/$AWS_ACCOUNT_ID/g" {} +; 
fi




# if the system is using git-defender and the repo is not configured, configure it
if [ -z "$(type \"git-defender\" 2>/dev/null)" ] && ! grep -q "\[defender\]" .git/config ; then
  echo "Found git-defender, but repo is not configured.  Proceeding to configure repo for git-defender"
  (sleep 1; echo -e "y\n"; sleep 1; echo -e "y\n";)|git defender --setup
  echo ""
  echo ""
fi

# Add and commit changes to repo if there are files to commit
if [ -n "$(git status --porcelain=v1 2>/dev/null)" ]; then
  git add --all
  git commit --no-verify -m "Reference Commit"
  git push
else
  echo "No changes to commit."
fi
echo "Finished setting up the backstage reference repo."


