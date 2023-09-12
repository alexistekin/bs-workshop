#!/usr/bin/env bash

# Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.

# This script is a wizard that will delete an application environment
# for you by walking you through a guided series of questions

scriptDir=$( cd -- "$( dirname -- "${BASH_SOURCE[0]}" )" &> /dev/null && pwd )
source $scriptDir/utility-functions.sh "source delete_env_wizard" 1> /dev/null

display "\nWelcome to the Delete Application Environment Wizard!\n"

validate_bash_version
source $scriptDir/../build-script/empty-s3.sh 1> /dev/null

display "Note: This wizard does NOT delete a running application. Instead, it deletes the assets"
display "that were created to support deploying your application to an isolated environment."
display "Before deleting environment assets, you should delete the application itself from the"
display "environment, such as by running \"terraform destroy\" or \"cdk destroy\" for example.\n"
display "By continuing this wizard, you will be given a choice of which environment assets you"
display "wish to delete.\n"
display "Things that can be deleted by this wizard:"
display "  * Environment variables set on remote stores such as AWS Parameter Store or GitLab CI"
display "  * CICD pipeline IAM role CloudFormation stack"
display "  * Terraform back end CloudFormation stack"
display "  * CDK bootstrap CloudFormation stack"
display "  * Local environment-<env>.json that holds the configurations for the environment\n"

choose_local_environment deleteEnv "Which environment would you like to delete?"
yes_or_no deleteEnvSure "Are you sure you want to delete the \"$deleteEnv\" environment?" "n"
display ""

if [[ "$deleteEnvSure" != "y" ]]; then
    exit 0
fi

origCurEnv=$(get_current_env)
set_current_env $deleteEnv

# Clear cache for old environment and re-source utility functions so that 
# all variables reference the selected environment
ENV_RECONCILED_JSON=""
CPA_ENV_VAR_FILE_NAME=""
source $scriptDir/utility-functions.sh "source delete_env_wizard" 1> /dev/null

set_aws_cli_profile
validate_aws_cli_account || exit 1

# Delete remote variables if applicable
if [[ "$REMOTE_ENV_VAR_LOC" == "ssm" ]]; then
    delete_ssm_remote_vars_for_env
elif [[ "$REMOTE_ENV_VAR_LOC" == "gitlab" ]]; then
    declare gitLabToken
    ask_gitlab_token gitLabToken ""
    
    if [[ -z "$gitLabToken" ]]; then
        display "Skipping deleting environment data from GitLab."
    else 
        delete_gitlab_cicd_vars_for_env "$gitLabToken"
        delete_gitlab_cicd_environment "$gitLabToken"
    fi
fi

# Delete CICD pipeline IAM role if applicable
if [[ ! -z "$AWS_CREDS_TARGET_ROLE" ]]; then
    roleStackName="$APP_NAME-$ENV_NAME-cicd-role"
    display ""
    yes_or_no deleteCicdRoleStack "Are you sure you want to delete the CICD pipeline IAM role CloudFormation stack \"$roleStackName\"?" "n"
    display ""

    if [[ "$deleteCicdRoleStack" == "y" ]]; then
        display "\nDeleting CloudFormation stack \"$roleStackName\" ..."
        aws cloudformation delete-stack --stack-name $roleStackName
        aws cloudformation wait stack-delete-complete --stack-name $roleStackName
        display "  DONE Deleting CloudFormation stack \"$roleStackName\""
    fi
fi

# Delete Terraform backend if applicable
if [[ ! -z "$TF_S3_BACKEND_NAME" ]]; then
    tfStackName="$TF_S3_BACKEND_NAME"

    display "\n${YELLOW}WARNING: make sure that you have executed \"terraform destroy\"${NC}"
    display "${YELLOW}to delete your application before you delete the Terraform back end${NC}\n"

    yes_or_no deleteTfBackendStack "Are you sure you want to delete the Terraform back end CloudFormation stack \"$tfStackName\"?" "n"
    display ""

    if [[ "$deleteTfBackendStack" == "y" ]]; then
        empty_s3_bucket_by_name "$APP_NAME-$ENV_NAME-tf-back-end-$AWS_ACCOUNT_ID-$AWS_DEFAULT_REGION"
        display "\nDeleting CloudFormation stack \"$tfStackName\" ..."
        aws cloudformation delete-stack --stack-name $tfStackName
        aws cloudformation wait stack-delete-complete --stack-name $tfStackName
        display "  DONE Deleting CloudFormation stack \"$tfStackName\""
    fi
fi

# Delete CDK v2 bootstrap CloudFormation stack if applicable
cdkJsonFile=$(find $projectIacDir -type f -name 'cdk.json')
if [[ ! -z "$cdkJsonFile" ]]; then
    cdk2StackName="CDKToolkit"

    display "\n${YELLOW}WARNING: make sure that you have executed \"cdk destroy\"${NC}"
    display "${YELLOW}to delete your application before you delete the CDK bootstap stack.${NC}"
    display "${YELLOW}Do not delete the CDK bootstrap stack if other applications have${NC}"
    display "${YELLOW}been deployed to your account that utilize CDK${NC}.\n"

    yes_or_no deleteCdk2BootstrapStack "Are you sure you want to delete the CDK v2 bootstrap CloudFormation stack \"$cdk2StackName\"?" "n"
    display ""

    if [[ "$deleteCdk2BootstrapStack" == "y" ]]; then
        cdkBucketName="cdk-hnb659fds-assets-$AWS_ACCOUNT_ID-$AWS_DEFAULT_REGION"
        empty_s3_bucket_by_name "$cdkBucketName"
        display "\nDeleting CDK v2 Bootstrap CloudFormation stack \"$cdk2StackName\" ..."
        aws cloudformation delete-stack --stack-name $cdk2StackName
        aws cloudformation wait stack-delete-complete --stack-name $cdk2StackName
        display "  DONE Deleting CDK v2 Bootstrap CloudFormation stack \"$cdk2StackName\""
    fi
fi

# delete .environment-<env>.json file
display ""
yes_or_no deleteConfigSure "Are you sure you want to delete the local environment configuration file at \"$CPA_ENV_VAR_FILE_NAME\"?" "n"
display ""

if [[ "$deleteConfigSure" == "y" ]]; then
    rm $CPA_ENV_VAR_FILE_NAME
    display "DELETED: \"$CPA_ENV_VAR_FILE_NAME\"\n"
fi

# check if deleted environment was the current environment
if [[ "$origCurEnv" != "$deleteEnv" ]]; then
    set_current_env $origCurEnv
    display "\nSetting the current environment to \"$origCurEnv\"."
else
    localEnvNames=$(get_local_environment_names)

    if [[ -z "$localEnvNames" ]]; then
        display "\nThere are no local environments left. You will need to create a new one to continue working on this app."
        set_current_env "setme"
    else
        display "\nThe current environment has been deleted. Please choose another environment to make current."
        switch_local_environment
    fi
fi

display "\n${GREEN}Congratulations! The \"$deleteEnv\" environment has been deleted!${NC}\n"
