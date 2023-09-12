#!/usr/bin/env bash

# Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.

# This script is a wizard that will create a new local environment
# for you by walking you through a guided series of questions.
# It can also be run in "headless" mode by supplying a JSON file
# with environment values as the first argument to the script.

# Get original values for stdin and stderr for later reference
exec 21>&1
exec 22>&2

scriptDir=$( cd -- "$( dirname -- "${BASH_SOURCE[0]}" )" &> /dev/null && pwd )
source $scriptDir/utility-functions.sh "source create_env_wizard" 1> /dev/null
validate_bash_version
source $scriptDir/create-app-env-questions.sh 1> /dev/null

if [[ -f "$scriptDir/dynamic-lookups.sh" ]]; then
    source $scriptDir/dynamic-lookups.sh 1> /dev/null
else
    declare -A LOOKUPS=()
fi

# Write user choices to JSON cache file used by subsequent wizard run default values
write_choices_to_cache_file () {

    # Reinstate original stdout and stderr that may have been redirected
    exec 1>&21
    exec 2>&22

    # Enable echo. This may have been disabled when reading secret values
    stty echo

    populate_create_app_env_choice_cache_array
    printf -v joined '%s,' "${choiceEnvCacheArray[@]}"
    echo -n "${joined%,}" | jq -R -s 'split(",") | map(split("=")) | map({(.[0]): .[1]}) | add' > $choiceCacheFilePath

    log "\nExiting from write_choices_to_cache_file trap.\n"
}

# Add an event handler for when the script exits
trap write_choices_to_cache_file EXIT

choiceCacheFilePath=$scriptDir/.choice-cache.json
choiceCacheJson=""
choiceEnvCacheArray=()

# Exports (as environment variables) all values defined in the supplied .json
# file so that this wizard can run in headless mode.
# param1: a working path (absolute or relative) to the JSON file 
#         containing wizard answers
export_wizard_answers () {
    
    if ! command -v jq --version &> /dev/null
    then
        displayIssue "jq could not be found. Please install jq, then run this script again." "error"
        exit 1
    fi

    if [[ ! -f "$1" ]]; then
        displayIssue "Failed to get headless mode values from JSON file." "error"
        displayIssue "File \"$1\" does not exist."
        exit 1
    fi

    eval "export $(cat "$1" \
    | jq -r 'to_entries | map("\(.key)=\(.value)") | @sh')"
}

init_interactive_mode () {

    CREATED_BY="blank"

    # Note - the following value was generated at project creation time.
    # Edit with caution.
    initialChoiceVals="defaultAppName=pacetf,defaultAwsAccountNum=649115557262,defaultRegion=us-east-1,defaultDeployRole=n,defaultDeployRemoteEnvVars=n,defaultRemoteEnvVarLoc=gitlab,defaultDeployTfBackend=n,defaultDeployCdk2Backend=n,defaultSonarQubeHostUrl=https://www.dev.sonar.qube.aws-prototyping.cloud,"

    # --------------------------------------------------------------
    if [[ -f $choiceCacheFilePath ]]; then
        yes_or_no useChoiceCache "Would you like to load default selections from previous run" "y"
        if [[ $useChoiceCache =~ ^[Yy]$ ]]; then
            choiceCacheJson=$(<$choiceCacheFilePath)
        fi
    elif [[ ! -z "$initialChoiceVals" ]]; then
        # Create a local choice cache file based on initial project creation values
        echo -n "${initialChoiceVals%,}" | jq -R -s 'split(",") | map(split("=")) | map({(.[0]): .[1]}) | add' > $choiceCacheFilePath

        useChoiceCache="y"
        choiceCacheJson=$(<$choiceCacheFilePath)
        
        log "\n$choiceCacheFilePath not found. Created it based on initialChoiceVals."
    fi

    log "\nChoice Cache JSON:"
    log "$choiceCacheJson"
}

detect_settings () {
    set_git_env_vars_from_remote_origin

    if [[ " ${ENV_KEYS[*]} " =~ " TF_S3_BACKEND_NAME " ]]; then
        iac="terraform"
    fi

    cdkJsonFile=$(find $projectIacDir -type f -name 'cdk.json')
    if [[ ! -z "$cdkJsonFile" ]]; then
        iac="cdk2"
    fi

    if [[ " ${ENV_KEYS[*]} " =~ " AWS_CREDS_TARGET_ROLE " ]]; then
        AWS_CREDS_TARGET_ROLE="arn:aws:iam::${AWS_ACCOUNT_ID}:role/${APP_NAME}-${ENV_NAME}-cicd-role"
    fi

    if [[ -d "$scriptDir/../cicd" ]] || [[ -d "$projectIacRootModuleDir/$projectCicdModuleName" ]]; then
        useCicd="y"
    else 
        useCicd="n"
    fi

    if [[ -f "$scriptDir/../.gitlab-ci.yml" ]]; then
        cicd="gitlab"
    fi

    if [[ -f "$scriptDir/../sonar-project.properties" ]]; then
        useSonarQube="y"
    else 
        useSonarQube="n"
    fi
}

run_interactive_mode () {
    
    if [[ -v "ENV_CONSTANTS['AWS_ACCOUNT_ID']" ]] && [[ ! -z "${ENV_CONSTANTS['AWS_ACCOUNT_ID']}" ]]; then
        AWS_ACCOUNT_ID="${ENV_CONSTANTS['AWS_ACCOUNT_ID']}"
    else
        ask_aws_account_number
    fi
    
    set_aws_cli_profile

    if [[ -v "ENV_CONSTANTS['AWS_DEFAULT_REGION']" ]] && [[ ! -z "${ENV_CONSTANTS['AWS_DEFAULT_REGION']}" ]]; then
        AWS_DEFAULT_REGION="${ENV_CONSTANTS['AWS_DEFAULT_REGION']}"
    else
        ask_aws_region "AWS_DEFAULT_REGION"
    fi
    
    if [[ "$awsDeployDisabled" == "n" ]]; then
        set_aws_cli_profile
        validate_aws_cli_account || exit 1
    fi

    if [[ " ${ENV_KEYS[*]} " =~ " AWS_SECONDARY_REGION " ]]; then
        AWS_PRIMARY_REGION="$AWS_DEFAULT_REGION"

        if [[ -v "ENV_CONSTANTS['AWS_SECONDARY_REGION']" ]] && [[ ! -z "${ENV_CONSTANTS['AWS_SECONDARY_REGION']}" ]]; then
            AWS_SECONDARY_REGION="${ENV_CONSTANTS['AWS_SECONDARY_REGION']}"
        else
            ask_aws_region "AWS_SECONDARY_REGION"
        fi
    fi

    if [[ -v "ENV_CONSTANTS['APP_NAME']" ]] && [[ ! -z "${ENV_CONSTANTS['APP_NAME']}" ]]; then
        APP_NAME="${ENV_CONSTANTS['APP_NAME']}"
    else
        ask_app_name
    fi

    if [[ -v "ENV_CONSTANTS['ENV_NAME']" ]] && [[ ! -z "${ENV_CONSTANTS['ENV_NAME']}" ]]; then
        ENV_NAME="${ENV_CONSTANTS['ENV_NAME']}"
    else
        ask_environment_name "ignoreDefault"
    fi

    # Even though this value is set by detect_settings, we update it here with the latest user entries
    if [[ " ${ENV_KEYS[*]} " =~ " AWS_CREDS_TARGET_ROLE " ]]; then

        if [[ -v "ENV_CONSTANTS['AWS_CREDS_TARGET_ROLE']" ]] && [[ ! -z "${ENV_CONSTANTS['AWS_CREDS_TARGET_ROLE']}" ]]; then
            AWS_CREDS_TARGET_ROLE="${ENV_CONSTANTS['AWS_CREDS_TARGET_ROLE']}"
        else
            AWS_CREDS_TARGET_ROLE="arn:aws:iam::${AWS_ACCOUNT_ID}:role/${APP_NAME}-${ENV_NAME}-cicd-role"
        fi
    fi

    if [[ " ${ENV_KEYS[*]} " =~ " ENABLE_ONCE_PER_ACCOUNT_RESOURCES " ]]; then

        if [[ -v "ENV_CONSTANTS['ENABLE_ONCE_PER_ACCOUNT_RESOURCES']" ]] && [[ ! -z "${ENV_CONSTANTS['ENABLE_ONCE_PER_ACCOUNT_RESOURCES']}" ]]; then
            ENABLE_ONCE_PER_ACCOUNT_RESOURCES="${ENV_CONSTANTS['ENABLE_ONCE_PER_ACCOUNT_RESOURCES']}"
        else
            ask_enable_once_per_account_resources
        fi
    fi

    if [[ "$iac" == "terraform" ]]; then
        optionally_inform_tf_backend_name
    fi

    if [[ "$useCicd" == "y" ]]; then
        ask_if_use_new_environment_with_cicd_pipeline
        useCicd=$useEnvWithCicd
    fi

    ask_where_to_store_remote_env_vars

    if [[ -v "ENV_CONSTANTS['SONAR_HOST_URL']" ]] && [[ ! -z "${ENV_CONSTANTS['SONAR_HOST_URL']}" ]]; then
        SONAR_HOST_URL="${ENV_CONSTANTS['SONAR_HOST_URL']}"
    else
        optionally_ask_sonarqube_host_url ""
    fi

    if [[ -v "ENV_CONSTANTS['SONAR_PROJECT_KEY']" ]] && [[ ! -z "${ENV_CONSTANTS['SONAR_PROJECT_KEY']}" ]]; then
        SONAR_PROJECT_KEY="${ENV_CONSTANTS['SONAR_PROJECT_KEY']}"
    else
        optionally_ask_sonarqube_project_key
    fi
    
    if [[ "$SONAR_PROJECT_KEY" == "generate" ]]; then
        create_sonarqube_project
    fi

    optionally_ask_created_by
    ask_if_deploy_cicd_iam_role
    optionally_ask_push_env_vars
    ask_if_deploy_terraform_backend_cf_stack
    ask_if_deploy_cdk2_bootstrap_cf_stack

    # Check for custom environment variables added to app-env-var-names.txt
    # that are application-specific
    frameworkVars=$(get_framework_env_var_names)
    for varIndex in ${!ENV_KEYS[@]}; do
        varName=${ENV_KEYS[$varIndex]}

        if [[ ! " $frameworkVars " =~ " ${varName} " ]] && [[ -z "${LOOKUPS[$varName]}" ]]; then

            # do not prompt for Git repo entries
            if [[ "$varName" =~ ^(gitProjectName|gitProjectGroup|gitRepoDomain)$ ]]; then continue; fi

            if [[ -v "ENV_CONSTANTS[$varName]" ]] && [[ ! -z "${ENV_CONSTANTS[$varName]}" ]]; then
                varName="${ENV_CONSTANTS[$varName]}"
            else
                display ""
                length_range customVal "Enter a value for $varName:" \
                "" "0" "100" "allowWhitespace"
                customVal="${customVal:=blank}"
                dynamicVarSet="${varName}=\"$customVal\""
                eval $dynamicVarSet
            fi

        fi
    done
}

validate_headless_mode_input () {
    local awsAcctPattern="^[0-9]{12}$"
    if [[ ! $AWS_ACCOUNT_ID =~ $awsAcctPattern ]]; then
        displayIssue "invalid \"AWS_ACCOUNT_ID\" value: \"$AWS_ACCOUNT_ID\". Must be a 12-digit number." "error"
        exit 1
    fi

    if [[ "$REMOTE_ENV_VAR_LOC" != "ssm" ]] && [[ "$REMOTE_ENV_VAR_LOC" != "gitlab" ]] && [[ "$REMOTE_ENV_VAR_LOC" != "na" ]]; then
        displayIssue "invalid \"REMOTE_ENV_VAR_LOC\" value: \"$REMOTE_ENV_VAR_LOC\". Must be \"ssm\" or \"gitlab\" or \"na\"." "error"
        exit 1
    fi

    if [[ "$REMOTE_ENV_VAR_LOC" == "na" ]] && [[ "$deployRole" == "y" ]]; then
        displayIssue "invalid \"deployRole\" value: \"$deployRole\". Must be \"n\" if REMOTE_ENV_VAR_LOC is \"na\"." "error"
        exit 1
    fi

    [[ ! "$APP_NAME" =~ ^[^[:space:]]{1,10}$ ]] && \
    displayIssue "\"APP_NAME\" value is invalid: \"$APP_NAME\"." "error" && \
    displayIssue "Must not include whitespace and length (${#APP_NAME}) must be between 1 and 10." && \
    exit 1
    
    [[ ! "$ENV_NAME" =~ ^[^[:space:]]{1,6}$ ]] && \
    displayIssue "\"ENV_NAME\" value is invalid: \"$ENV_NAME\"." "error" && \
    displayIssue "Must not include whitespace and length (${#ENV_NAME}) must be between 1 and 6." && \
    exit 1

    [[ ! "$AWS_DEFAULT_REGION" =~ ^[^[:space:]]{5,30}$ ]] && \
    displayIssue "\"AWS_DEFAULT_REGION\" value is invalid: \"$AWS_DEFAULT_REGION\"." "error" && \
    displayIssue "Must not include whitespace and length (${#AWS_DEFAULT_REGION}) must be between 5 and 30." && \
    exit 1

    if [[ " ${ENV_KEYS[*]} " =~ " ENABLE_ONCE_PER_ACCOUNT_RESOURCES " ]]; then
        validate_true_or_false "ENABLE_ONCE_PER_ACCOUNT_RESOURCES" "$ENABLE_ONCE_PER_ACCOUNT_RESOURCES"
    fi
    
    validate_yes_or_no "useCicd" "$useCicd"
    validate_yes_or_no "useEnvWithCicd" "$useEnvWithCicd"
    validate_yes_or_no "deployRole" "$deployRole"

    if [[ "$deployRemoteEnvVars" == "y" ]] && [[ "$cicd" == "gitlab" ]]; then
        if [[ -z "$gltoken" ]]; then
            displayIssue "No value found for GitLab personal access token." "error"
            displayIssue "You must set \"gltoken\" as an environment variable with the token value"
            displayIssue "or set \"deployRemoteEnvVars\" to \"n\"."
            exit 1
        fi
    fi
}

set_headless_mode_default_values () {
    if [[ "$REMOTE_ENV_VAR_LOC" == "na" ]]; then
        useEnvWithCicd="n"
    else
        useEnvWithCicd="y"
    fi

    if [[ -z "$deployRole" ]]; then
        deployRole="$useEnvWithCicd"
    fi

    deployRemoteEnvVars="$useEnvWithCicd"

    if [[ "$iac" == "terraform" ]]; then
        deployTfBackend="y"
    else
       deployTfBackend="n" 
    fi
    
    if [[ "$iac" == "cdk2" ]]; then
        deployCdk2Backend="y"
    else
        deployCdk2Backend="n"
    fi
}

# Sets environment state using the new values supplied by the user
build-environment-from-memory () {
    local envVarKeyValuePairs=()

    for i in ${!ENV_KEYS[@]}; do
        local varName=${ENV_KEYS[$i]}

        if [[ ! -z "${LOOKUPS[$varName]}" ]]; then 
            continue
        fi
        
        local envVarValue=${!varName}
        envVarKeyValuePairs+=("${varName}=${envVarValue}")
    done

    # Create JSON string that holds the new environment settings
    local joined
    printf -v joined '%s,' "${envVarKeyValuePairs[@]}"
    local newEnvJson=$(echo "${joined%,}" | jq -R 'split(",") | map(split("=")) | map({(.[0]): .[1]}) | add')

    ENV_CONFIGS=()
    while IFS="=" read -r key value
    do
        ENV_CONFIGS[$key]="$value"
    done < <(echo "$newEnvJson" | jq -r 'to_entries|map("\(.key)=\(.value)")|.[]')

    log "\nNew ENV_CONFIGS:"
    for i in ${!ENV_CONFIGS[@]}; do
        log "$i = ${ENV_CONFIGS[$i]}"
    done

    set_reconciled_json

    envVarValueJsonFile=".environment-$ENV_NAME.json"

    local finalNewEnvJson=$(app_env_vars_to_json)

    echo "$finalNewEnvJson" > $scriptDir/$envVarValueJsonFile
    log "\nCreated new \"$ENV_NAME\" environment JSON configuration file: $scriptDir/$envVarValueJsonFile\n"

    log ""
    echo $ENV_NAME > $scriptDir/.current-environment
    log "Set \"$ENV_NAME\" into $scriptDir/.current-environment\n"

    log "\n$envVarValueJsonFile Contents:"
    log "$finalNewEnvJson"

    log "\nNew ENV_RECONCILED_JSON:"
    log "$ENV_RECONCILED_JSON"
}

display "\nWelcome to the Create/Update App Environment Wizard!\n"

if [[ ! -z "$1" ]]; then
    export HEADLESS="y"
    export_wizard_answers "$1"
    detect_settings
    set_headless_mode_default_values
    validate_headless_mode_input

    display "Running in headless mode."

    if [[ "$useCicd" == "y" ]]; then
        display "Default settings can be overriden by setting environment variables in the shell before running this wizard."
        display "Settings:"
        display "deployRole=$deployRole"
        display "Explanation: deployRole can be set to \"y\" if you want the CICD IAM role to be deployed to AWS"
    fi
    
    display ""
    
else
    init_interactive_mode
    detect_settings
    run_interactive_mode
fi

# --------------------------------------------------------------

# Write out new environment json file
build-environment-from-memory


if [[ "$iac" != "cf" ]]; then
    optionally_deploy_cicd_resources
else
    optionally_deploy_cicd_iam_role
fi

optionally_push_env_vars_to_remote
optionally_deploy_terraform_back_end_cf_stack
optionally_deploy_cdk2_bootstrap_cf_stack

display "\n${GREEN}Congratulations! Your \"$ENV_NAME\" application environment has been created.${NC}\n"
display "You can open the \"environment/$envVarValueJsonFile\" file to see what settings were generated."
display "This file can be modified by you as necessary or you can always rerun this wizard.\n"
