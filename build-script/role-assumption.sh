#!/usr/bin/env bash

# Usage ./build-script/role-assumptions.sh {PROFILE_NAME}

# Pre-req: make sure that you've run `mwinit --aea` to get your midway stuff set up

scriptDir=$( cd -- "$( dirname -- "${BASH_SOURCE[0]}" )" &> /dev/null && pwd )
source $scriptDir/helpers.sh

# Save the current user's profile arn in case the trust policy needs to be updated
CURRENT_ROLE_ARN=$(aws sts get-caller-identity --output text --query 'Arn')
# if we didn't get a role arn, then exit since we won't be able to do much of anything
if [[ $? != 0 ]]; then
  echo "Current role could not be determined.  No further actions will be possible."
  echo "Ensure that your environment is set up correctly for AWS access and try again."
  exit
fi


# first, "clean up" any previously set "AWS_" env vars and reset to your preferred profile
unset AWS_ACCOUNT && unset AWS_SESSION_TOKEN && unset AWS_ACCESS_KEY_ID && unset AWS_SECRET_ACCESS_KEY 

confirm_aws_account

# next, assume the master role
AWS_ACCOUNT=$(aws sts get-caller-identity --query "Account" --output text)
echo Proceeding with AWS_ACCOUNT=$AWS_ACCOUNT
ROLE_OUTPUT=$(aws sts assume-role --role-arn "arn:aws:iam::${AWS_ACCOUNT}:role/backstage-master-role" --role-session-name "localTestUser-${AWS_ACCOUNT}" --duration-second=3600 --output json) > /dev/null
# echo ROLE_OUTPUT=$ROLE_OUTPUT

if [[ $? != 0 ]]; then
  echo "Error assuming the backstage-master-role.  Proceeding to add current user/role to master role trust policy"
  # Get the trust policy for backstage-master-role
  ROLE_TRUST_POLICY=$(aws iam get-role --role-name backstage-master-role --query 'Role.AssumeRolePolicyDocument' --output json)
  NEW_TRUST_POLICY=$(echo ${ROLE_TRUST_POLICY} | jq -c ".Statement[0].Principal.AWS=\"${CURRENT_ROLE_ARN}\"") # | jq -R .)

  eval $(aws iam update-assume-role-policy --role-name backstage-master-role --policy-document ${NEW_TRUST_POLICY})

  # sleep for 5 seconds to allow the trust policy to propagate
  echo "Sleeping for 10 seconds to allow trust policy propagation"
  sleep 10

  ROLE_OUTPUT=$(aws sts assume-role --role-arn "arn:aws:iam::${AWS_ACCOUNT}:role/backstage-master-role" --role-session-name "localTestUser-${AWS_ACCOUNT}" --duration-second=3600 --output json)
fi

export AWS_ACCESS_KEY_ID=$(echo ${ROLE_OUTPUT} | jq -r '.Credentials.AccessKeyId')
export AWS_SECRET_ACCESS_KEY=$(echo ${ROLE_OUTPUT} | jq -r '.Credentials.SecretAccessKey')
export AWS_SESSION_TOKEN=$(echo ${ROLE_OUTPUT} | jq -r '.Credentials.SessionToken')
unset AWS_PROFILE

# optionally, verify that you're running under the correct backstage-master-role
PROCESS_ROLE_ARN=$(aws sts get-caller-identity --output text --query 'Arn')

# now, you can start backstage locally.  CAVEAT - chained, assumed roles can only have a 1-hr max duration.  You have to re-run through the steps above each hour :(
echo "Starting backstage locally with role assumption of ${PROCESS_ROLE_ARN}"
if [[ $1 == "debug" ]]; then
  make stop-local start-local-debug
else
  make stop-local start-local
fi