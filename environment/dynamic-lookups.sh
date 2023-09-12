#!/usr/bin/env bash

# Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.

# This script allows you to configure dynamic lookups for placeholder resolution.
# For example, you can define a placeholder in a file and have it be resolved
# with a value that was retreived from the SSM Parameter Store or Secrets Manager. 
# To accomplish this, you configure an association in this file between your 
# placeholder and the path to lookup the value.
# Examples:
# LOOKUPS[SSM_MYVAR]=/$APP_NAME/$ENV_NAME/someOptionalPath/myVar
# LOOKUPS[SECRET_MYSECRETVAR]=$APP_NAME-config

# This example will set your variable value to the "username" property
# of a secret if the secret holds a JSON object that has "username"
# as one of its properties. Just add "_PROP_<myPropName>" to the name
# of the lookup to configure this behavior.
# LOOKUPS[SECRET_MYSECRETVAR_PROP_username]=$APP_NAME-config

# Add dynamic lookup configurations here:

# GitLab
LOOKUPS[SECRET_GITLAB_CONFIG_PROP_apiToken]=$GITLAB_SECRET_NAME
LOOKUPS[SSM_GITLAB_HOSTNAME]=/$APP_NAME/gitlab-hostname
LOOKUPS[SSM_GITLAB_URL]=/$APP_NAME/gitlab-url

LOOKUPS[SSM_PIPELINE_ROLE_ARN]=/$APP_NAME/pipeline-role
