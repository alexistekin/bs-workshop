#!/usr/bin/env bash

# Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.

# This is a convenience script to delete GitLab repositories created for Backstage,
# as well as application secrets and ECR repos.

scriptDir=$( cd -- "$( dirname -- "${BASH_SOURCE[0]}" )" &> /dev/null && pwd )
source $scriptDir/helpers.sh

usage() {
  echo ""
  echo "usage: ./$(basename $0) [-h] [-s] [-e] [-c pattern] [-l pattern]"
  echo "  -h: help"
  echo "  -s: delete all secrets beginning with 'aws-apps-'"
  echo "  -e: delete all ECR repos that don't start with 'aad' or 'cdk'"
  echo "  -c: delete all Cloudformation stacks that match a regex pattern (can be used multiple times)"
  echo "  -l: delete all CloudWatch log groups that match a regex pattern (can be used multiple times)"
  # echo "  -o: delete all repositories whose owner matches a regex pattern (can be used multiple times)"
  # echo "  -g: delete all repositories that belong to a group that matches a regex pattern (can be used multiple times)"
  echo ""
  echo "When run with no command-line options, the script will interactively ask about resources to delete"
}

# Process any command-line arguments using built-in bash getopts functionality
# list of arguments expected in the input
optstring=":hsec:l:o:g:"

while getopts ${optstring} option; do
  case ${option} in
    h ) # display help information
        usage
        exit 0
        ;;
    s ) # Delete secrets
        DELETE_SECRETS=true
        ;;
    e ) # Delete ECR repos
        DELETE_ECR_REPOS=true
        ;;
    c ) # Delete Cloudformation stacks matching a pattern
        STACK_PATTERNS+=("$OPTARG")
        DELETE_CF_STACKS=true
        ;;
    l ) # Delete CloudWatch log groups matching a pattern
        LOG_GROUP_PATTERNS+=("$OPTARG")
        DELETE_LOG_GROUPS=true
        ;;
    o ) # store gitlab owners of repositories whose repositories should be deleted
        echo "option -o called with parameter $OPTARG" >&2
        echo_warn "-o not implemented yet for headless mode"
        exit 1
        OWNERS+=("$OPTARG")
        ;;
    g ) # store gitlab groups with repositories that should be deleted
        echo "option -g called with parameter $OPTARG" >&2
        echo_warn "-g not implemented yet for headless mode"
        exit 1
        GROUPS+=("$OPTARG")
        ;;
    \? ) # unknown option
        echo_error "Unknown option: -$OPTARG" >&2;
        usage
        exit 2
        ;;
    : ) # required argument missing
        echo_error "Missing option argument for -$OPTARG" >&2; 
        usage
        exit 1
        ;;
    * ) # option is not implemented
        echo_error "Unimplemented option: -$option" >&2;
        usage
        exit 1
        ;;
  esac
done
# Set HEADLESS_MODE to true if any options were passed
if [ $OPTIND -ne 1 ]; then HEADLESS_MODE=true; fi
shift $((OPTIND -1))


#### 
# Deletes Gitlab repositories owned by a given user
# GLOBALS: 
# 	SSM_GITLAB_HOSTNAME - GitLab hostname
# 	SECRET_GITLAB_CONFIG_PROP_apiToken - GitLab API token
# ARGUMENTS: 
# 	A single argument, the owner of the repositories to delete
###
delete_repos_by_owner () {
  OWNER="$1"
  echo_ok "\nChecking for repositories owned by the '${OWNER}' user at ${SSM_GITLAB_HOSTNAME}"
  GITLAB_USER_ID=$(curl -s --request GET --header "PRIVATE-TOKEN: ${SECRET_GITLAB_CONFIG_PROP_apiToken}" "https://${SSM_GITLAB_HOSTNAME}/api/v4/users/" | jq ".[] | select(.username == \"${OWNER}\") | .id")
  REPOS=($(curl -s --request GET --header "PRIVATE-TOKEN: ${SECRET_GITLAB_CONFIG_PROP_apiToken}" "https://${SSM_GITLAB_HOSTNAME}/api/v4/users/${GITLAB_USER_ID}/projects" | jq -r '.[].name' ) )
  if (( ${#REPOS[@]} == 0 )); then
    echo -e "\tNo repositories found"
  else
    echo -e "Repositories to delete: ${#REPOS[@]}"

    for i in "${REPOS[@]}"
    do
      echo -e "\tDeleting $i"
      curl -s --request DELETE --header "PRIVATE-TOKEN: ${SECRET_GITLAB_CONFIG_PROP_apiToken}" "https://${SSM_GITLAB_HOSTNAME}/api/v4/projects/${OWNER}%2F$i"
    done
  fi
}

####
# Deletes Gitlab repositories owned by a given group
# GLOBALS: 
# 	SSM_GITLAB_HOSTNAME - GitLab hostname
# 	SECRET_GITLAB_CONFIG_PROP_apiToken - GitLab API token
# ARGUMENTS: 
# 	A single argument, the group of the repositories to delete
###
delete_repos_by_group () {
  GROUP_NAME="$1"
  echo_ok "\nChecking for repositories owned by the '${GROUP_NAME}' group at ${SSM_GITLAB_HOSTNAME}"
  GITLAB_GROUP_ID=$(curl -s --request GET --header "PRIVATE-TOKEN: ${SECRET_GITLAB_CONFIG_PROP_apiToken}" "https://${SSM_GITLAB_HOSTNAME}/api/v4/groups" | jq -r ".[] | select(.name == \"${GROUP_NAME}\") | .id")
  REPOS=($(curl -s --request GET --header "PRIVATE-TOKEN: ${SECRET_GITLAB_CONFIG_PROP_apiToken}" "https://${SSM_GITLAB_HOSTNAME}/api/v4/groups/${GITLAB_GROUP_ID}/projects" | jq -r '.[].name'))
  echo_ok "\tDeleting ${#REPOS[@]} repositories in group ${GROUP_NAME}"
  if (( ${#REPOS[@]} == 0 )); then
    echo -e "\tNo repositories found"
  else
    echo -e "\tRepositories to delete: ${#REPOS[@]}"

    for i in "${REPOS[@]}"
    do
      echo -e "\tDeleting $i"
      curl -s --request DELETE --header "PRIVATE-TOKEN: ${SECRET_GITLAB_CONFIG_PROP_apiToken}" "https://${SSM_GITLAB_HOSTNAME}/api/v4/projects/${GROUP_NAME}%2F$i"
    done
  fi
}

#### 
# Deletes all SecretsManager secrets prefixed with a given string
# ARGUMENTS: 
# 	A single argument, the prefix of the secret names to delete
### 
delete_secrets() {
  echo_ok "\n\nDeleting SecretsManager secrets prefixed with '$1'"
  # Delete region replication first
  aws secretsmanager list-secrets | jq -r '.SecretList[].ARN' | grep -E  ":$1" | xargs -n1 -I{} aws secretsmanager remove-regions-from-replication --secret-id {} --remove-replica-regions "us-west-2" --no-cli-pager || true
  # Then delete the actual secret
  aws secretsmanager list-secrets | jq -r '.SecretList[].ARN' | grep -E  ":$1" | xargs -n1 -I{} aws secretsmanager delete-secret --secret-id {} --force-delete-without-recovery --no-cli-pager
}

####
# Deletes all ECR repositories that don't start with 'aad' or 'cdk'
# ARGUMENTS:
#   None
####
delete_ecr_repos() {
  echo_ok "\nDeleting ECR repositories (that don't start with 'aad' or 'cdk')"
  aws ecr describe-repositories | jq -r '.repositories[].repositoryName' | grep -E -v "^aad|cdk" | xargs -n1 -I{} aws ecr delete-repository --repository-name {} --force --no-cli-pager
}

####
# Deletes all CloudFormation stacks that match a given regex pattern
# Examples:
#   delete_cloudformation_stacks_by_pattern "^(prod|staging)-" - Deletes all CloudFormation stacks that start with 'prod-' or 'staging-'
#   delete_cloudformation_stacks_by_pattern "(ECS-ENV|EKS-ENV)$" - Deletes all CloudFormation stacks that end with 'ECS-ENV' or 'EKS-ENV'
# ARGUMENTS:
#   A single argument, the regex pattern to match
####
delete_cloudformation_stacks_by_pattern() {
  echo_ok "\nDeleting CloudFormation stacks matching the regex pattern $1"
  STACKS=($(aws cloudformation list-stacks --no-cli-pager | jq -r '.StackSummaries[] | select((.StackStatus == "CREATE_COMPLETE") or (.StackStatus == "UPDATE_COMPLETE")) | .StackName' | grep -E -i "$1"))
  if (( ${#STACKS[@]} == 0 )); then
    echo -e "\tNo stacks found"
  else
    echo "Found ${#STACKS[@]} CloudFormation stack(s) to delete"
    for i in "${STACKS[@]}"
    do
      echo -e "\tDeleting $i"
      aws cloudformation delete-stack --stack-name $i --no-cli-pager 
    done
  fi
}

####
# Deletes all CloudWatch log groups that match a given regex pattern
# Examples:
#   delete_cloudwatch_log_groups "/aws/apps/" - Deletes all CloudWatch log groups that contain '/aws/apps/'
# ARGUMENTS:
#   A single argument, the regex pattern to match
####
delete_cloudwatch_log_groups() {
  echo_ok "\nDeleting CloudWatch log groups matching the regex pattern $1"
  LOG_GROUPS=($(aws logs describe-log-groups | jq -r --arg PATTERN "$1" '.logGroups[] | select(.logGroupName|test($PATTERN)) | .logGroupName'))
  if (( ${#LOG_GROUPS[@]} == 0 )); then
    echo -e "\tNo log groups found"
  else
    echo "Found ${#LOG_GROUPS[@]} log group(s) to delete"
    for i in "${LOG_GROUPS[@]}"
    do
      echo -e "\tDeleting $i"
      aws logs delete-log-group --log-group-name $i --no-cli-pager 
    done
  fi
}

####
# Deletes inactive ECS task definitions
# NOT IMPLEMENTED YET!!
####
delete_ecs_task_definitions() {
  echo_warn "\nDeleting inactive ECS task definitions is not implemented yet"
  # TODO: Delete inactive ECS task definitions
  # *See code below
  # #!/bin/bash -e
  # 
  # die () {
  #     echo >&2 "$@"
  #     exit 1
  # }
  # 
  # [ "$#" -eq 2 ] || die "2 argument required, $# provided"
  # 
  # TASKNAME=$1
  # START=1 # the first number of the task revision to loop through
  # END=$2 # The last number to stop the delete loop at
  # 
  # # This function will deregister the task definition
  # #for (( x=$START; x<=$END; x++ ))
  # #do
  # #        aws ecs deregister-task-definition --task-definition $TASKNAME:$x --no-cli-pager
  # #        sleep 5
  # #        echo "The task $TASKNAME and revision $x has been deregistered"
  # #done
  # 
  # # This function will delete the task definition
  # for (( y=$START; y<=$END; y++ ))
  # do
  #         aws ecs delete-task-definitions --task-definition $TASKNAME:$y --no-cli-pager
  #         sleep 2
  #         echo "The task $TASKNAME and revision $y has been deleted"
  # done

}

####
# Delete resources without requesting any user input
# This mode solely relies on command-line options
# GLOBALS:
#   All of the globals are set when processing getopts
#
#   DELETE_SECRETS - Flag to indicate whether to delete secrets
#   DELETE_ECR_REPOS - Flag to indicate whether to delete ECR repos
#   DELETE_CF_STACKS - Flag to indicate whether to delete CF stacks
#   DELETE_LOG_GROUPS - Flag to indicate whether to delete CloudWatch log groups
#   STACK_PATTERNS - Array of regex patterns to match stack names to delete
#   LOG_GROUP_PATTERNS - Array of regex patterns to match log group names to delete
####
headless_delete() {
  # Delete secrets
  if [ -n "${DELETE_SECRETS}" ]; then
    delete_secrets 'aws-apps-'
  fi

  # Delete ECR repos
  if [ -n "${DELETE_ECR_REPOS}" ]; then
    delete_ecr_repos
  fi 

  # Delete CF stacks
  if [ -n "${DELETE_CF_STACKS}" ]; then
    for i in "${STACK_PATTERNS[@]}"
    do
      delete_cloudformation_stacks_by_pattern "$i"
    done
  fi

  # Delete CloudWatch log groups
  if [ -n "${DELETE_LOG_GROUPS}" ]; then
    for i in "${LOG_GROUP_PATTERNS[@]}"
    do
      delete_cloudwatch_log_groups "$i"
    done
  fi

}

####
# Delete resources interactively by requesting user confirmation
# GLOBALS:
#   sriptDir - The directory of this script
####
interactive_delete() {
  # get the gitlab admin token and hostname from .config/env
  eval $(grep "SECRET_GITLAB_CONFIG_PROP_apiToken" ${scriptDir}/../config/.env)
  eval $(grep "SSM_GITLAB_HOSTNAME" ${scriptDir}/../config/.env)

  yes_or_no deleteAwsAppRepos "\nDo you want to delete all app resources (aws-app GitLab repos and related secrets/ECR registries/CF stacks)?" "y"
  if [[ "$deleteAwsAppRepos" =~ ^([yY])$ ]]; then
    delete_repos_by_group 'aws-app'
    delete_secrets 'aws-apps-'
    # Commenting out the delete_ecs_task_definitions function call for now since aws-app ECR repos should be deleted via the CFN stack
    # delete_ecr_repos
    delete_cloudformation_stacks_by_pattern '(ecs-resources)$'
  fi

  yes_or_no deleteAadAdminRepos "\nDo you want to delete GitLab repos owned by aad-admin?" "n"
  if [[ "$deleteAadAdminRepos" =~ ^([yY])$ ]]; then
    delete_repos_by_owner 'aad-admin'
  fi

  yes_or_no deleteAwsEnvRepos "\nDo you want to delete GitLab repos under the aws-environments group?" "n"
  if [[ "$deleteAwsEnvRepos" =~ ^([yY])$ ]]; then
    delete_repos_by_group 'aws-environments'
  fi

  yes_or_no deleteAwsEnvProvidersRepos "\nDo you want to delete environment provider resources (aws-environment-providers GitLab repos and CF stacks)?" "n"
  if [[ "$deleteAwsEnvProvidersRepos" =~ ^([yY])$ ]]; then
    delete_repos_by_group 'aws-environment-providers'
    delete_cloudformation_stacks_by_pattern '^(ECS-ENV|EKS-ENV|SERVERLESS-ENV)'
  fi

  yes_or_no deleteAwsLogGroups "\nDo you want to delete all aws-apps CloudWatch log groups (prefixed with '/aws/apps')?" "n"
  if [[ "$deleteAwsLogGroups" =~ ^([yY])$ ]]; then
    delete_cloudwatch_log_groups '/aws/apps'
  fi

}

# ############################################
# Start the real workflow to delete resources
# ############################################
if [ -n "${HEADLESS_MODE}" ]; then
  # Peform deletions in headless mode
  echo_ok "Performing deletionsin headless mode"
  headless_delete
  exit
else  # Peform deletions in interactive mode
  confirm_aws_account
  interactive_delete
fi

