#!/usr/bin/env bash


# Define helper functions for pretty output
NC='\033[0m' # No Color
YELLOW='\033[1;33m'
GREEN='\033[1;32m'
RED='\033[1;31m'
echo_ok()    { echo -e "${GREEN}""$1""${NC}"; }
echo_warn()  { echo -e "${YELLOW}""$1""${NC}"; }
echo_error() { echo -e "${RED}ERROR: ""$1""${NC}"; }

# Asks a question with a default answer and will not return the 
# answer until it matches the supplied regex
# param1: the name of the variable to set using the Bash nameref feature
# param2: the question to ask
# param3: the default answer to the question
# param4: the regex pattern to match
# param5: the error message to show if the pattern does not match
get_answer () {
    local -n answer=$1
    local question=$2
    local defaultAnswer=$3
    local pattern=$4
    local msg=$5
    local defaultOptionString
    [ -z "$defaultAnswer" ] && defaultOptionString="" || defaultOptionString="[$defaultAnswer] "

    while true
    do
        read -p "$(echo -e "$question $defaultOptionString")" answer
        answer="${answer:=$defaultAnswer}"
        [[ $answer =~ $pattern ]] && return 0
        echo $msg >&2
    done
}

# Asks a yes or no question with a default answer and will not return the 
# answer until it is either y or n
# param1: the name of the variable to set using the Bash nameref feature
# param2: the question to ask
# param3: the default answer to the question 
yes_or_no () {
    local -n ynAnswer=$1
    local question=$2
    local defaultAnswer=$3
    local pattern="^[yn]$"
    local msg="answer must be y or n"
    question="${question} (y/n)?"

    get_answer ynAnswer "$question" "$defaultAnswer" "$pattern" "$msg"
}

confirm_aws_account() {
    cliAccountId=$(aws sts get-caller-identity --query Account --output text)
    echo ""

    if [[ -z "$AWS_ACCOUNT_ID" ]]; then
        echo "WARNING, AWS_ACCOUNT_ID is not set - cannot validate that you are logged into the right AWS account."
    elif [[ "$AWS_ACCOUNT_ID" != "$cliAccountId" ]]; then
        echo "ERROR: You are currently logged into account \"$cliAccountId\", but this script "
        echo "is trying to deploy to account \"$AWS_ACCOUNT_ID\"."
        echo "Update your AWS CLI profile or set the AWS_PROFILE environment variable to fix this."
        exit 1
    fi
}

############################
# Secret Value Helper Function #
############################
# Gets secret value from named secret
# Inputs:
# 1: Config Variable Name
# Example: $(get_secret_value $OKTA_SECRET_NAME)
get_secret_value() {
    SECRET_VALUE=$(aws secretsmanager get-secret-value --secret-id $1 --region $AWS_DEFAULT_REGION --output json | jq --raw-output '.SecretString')
    echo $SECRET_VALUE
}

# Set constants that can be referenced by other scripts
buildScriptDir=$( cd -- "$( dirname -- "${BASH_SOURCE[0]}" )" &> /dev/null && pwd )
backstageIacDir=$buildScriptDir/../iac/roots/aad-platform
backstageDir=$buildScriptDir/../backstage
GITLAB_USER_NAME=aad-admin
GITLAB_GROUP_NAME=aws-app
