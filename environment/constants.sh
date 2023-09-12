#!/usr/bin/env bash

# Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.

# This script allows you to change the names of directories that
# the environment scripts use as well as other settings.

# Set commands to be run before CPA takes any action
CPA_BEFORE_HOOKS+=('generate_make_env')
CPA_BEFORE_HOOKS+=('generate_env_file')

# Set commands to be run after user switches the current environment
CPA_AFTER_SWITCH_ENV_HOOKS+=('generate_env_file')

# Set application environment configuration key names that are okay to be
# logged in clear text by a CICD pipeline
CLEAR_TEXT_ENV_KEYS+=('APP_NAME')
CLEAR_TEXT_ENV_KEYS+=('AWS_ACCOUNT_ID')
CLEAR_TEXT_ENV_KEYS+=('AWS_CREDS_TARGET_ROLE')
CLEAR_TEXT_ENV_KEYS+=('AWS_DEFAULT_REGION')
CLEAR_TEXT_ENV_KEYS+=('CREATED_BY')
CLEAR_TEXT_ENV_KEYS+=('ENABLE_ONCE_PER_ACCOUNT_RESOURCES')
CLEAR_TEXT_ENV_KEYS+=('ENV_NAME')
CLEAR_TEXT_ENV_KEYS+=('SONAR_HOST_URL')
CLEAR_TEXT_ENV_KEYS+=('SONAR_PROJECT_KEY')
CLEAR_TEXT_ENV_KEYS+=('TF_S3_BACKEND_NAME')
# project custom configs
CLEAR_TEXT_ENV_KEYS+=('DEPLOYMENT_TYPE')
CLEAR_TEXT_ENV_KEYS+=('GITLAB_SECRET_NAME')
CLEAR_TEXT_ENV_KEYS+=('OKTA_SECRET_NAME')
CLEAR_TEXT_ENV_KEYS+=('SSM_PIPELINE_ROLE_ARN')
CLEAR_TEXT_ENV_KEYS+=('PLATFORM_ROLE_ARN')
CLEAR_TEXT_ENV_KEYS+=('SSM_GITLAB_HOSTNAME')
CLEAR_TEXT_ENV_KEYS+=('SSM_GITLAB_URL')


# Color codes used for outputting text in color to the console
CYAN='\033[0;36m'
GRAY='\033[0;37m'
GREEN='\033[0;32m'
NC='\033[0m' # No Color
PURPLE='\033[0;35m'
RED='\033[0;31m'
YELLOW='\033[1;33m'

# Set the package manager to use
cpaPackageManager="yarn" # can be set to "npm" or "yarn"

# Set the name of the JSON file that contains team constants
projectEnvConstantsFileName="environment-constants.json"

# Set the suffix to append to a filename when making a backup
BACKUP_SUFFIX=".bak"

# Set the path of the directory where the CPA scripts are located
projectEnvPath="/environment"

# Set directory where core environment scripts are
projectEnvDir=$( cd -- "$( dirname -- "${BASH_SOURCE[0]}" )" &> /dev/null && pwd )

# Set application root directory
projectDir="${projectEnvDir/$projectEnvPath/}" # set app root directory to parent of $projectEnvDir

# Set the directory where non-cpa configs are stored
projectConfigsPath="/config"
projectConfigsDir="${projectDir}${projectConfigsPath}"
projectConfigsEnvFileName=".env"

# Set the directory where infrastructure as code is stored
projectIacPath="/iac"
projectIacDir="${projectDir}${projectIacPath}"

# Set the directory where the infrastructure as code root modules are stored
projectIacRootModulePath="${projectIacPath}/roots"
projectIacRootModuleDir="${projectDir}${projectIacRootModulePath}"

# Set the directory where application build scripts are stored
projectBuildScriptPath="/build-script"
projectBuildScriptDir="${projectDir}${projectBuildScriptPath}"

# Set the name of the CICD module
projectCicdModuleName="cicd"

# Only used if IaC is CloudFormation. This value is ignored for CDK or Terraform
# Set the directory where CICD files are stored
projectCicdPath="/$projectCicdModuleName"
projectCicdDir="${projectDir}${projectCicdPath}"

# Set the name of the file where the current environment is set
projectCurrentEnvFileName="$projectEnvDir/.current-environment"

# Set to "y" if CPA template resolution should occur when CDK commands are run
projectCdkResolveTemplates="n"
