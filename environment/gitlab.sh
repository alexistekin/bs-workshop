#!/usr/bin/env bash

# Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.

# This script contains utility functions for interacting with GitLab

# Accepts a Bash nameref variable. If it has a blank value, the user
# will be prompted to enter a GitLab personal access token value and
# the user's input will be set as the nameref variable's value
ask_gitlab_token () {
    local -n gitLabTokenRef=$1

    if [[ ! -z "$HEADLESS" ]]; then
        # Headless mode expects that the GitLab personal access token
        # has been set into a "gltoken" environment variable
        gitLabTokenRef="$gltoken"

    else
        if [[ -z "$gitLabTokenRef" ]]; then
            display "\nFor security purposes, the text you type next will not be shown in the terminal."
            display "Enter your GitLab access token or press \"return\" to skip: "
            read_secret gitLabTokenRef
        fi

        # support passing in the token via a "gltoken" value, which will read the
        # value of the "gltoken" environment variable so that users do not need
        # to type the token in plain text 
        if [[ "$gitLabTokenRef" == "gltoken" ]]; then
            gitLabTokenRef="$gltoken"
        fi

    fi

}

# Sets these variables based on this project's GitLab remote origin
# gitProjectGroup
# gitProjectName
# gitRepoDomain
set_gitlab_env_vars_from_remote_origin () {
    local gitRemote=$(git remote get-url --push origin)

    if [[ -z "$gitRemote" ]]; then
        return 1
    elif [[ $gitRemote = https* ]]; then
        local gitApiHost=$([[ $gitRemote =~ (https://[^/]*) ]] && echo ${BASH_REMATCH[1]})
        local projectName=${gitRemote#"$gitApiHost/"}
    else
        local projectName=$(echo $gitRemote | sed 's/.*://')
        local gitApiHost=${gitRemote%":$projectName"}
        gitApiHost=${gitApiHost:8}
    fi

    gitRepoDomain="$gitApiHost"

    local gitName="${projectName#*/}" # example value: myrepo.git
    gitProjectGroup=${projectName%/$gitName}; #Remove suffix
    gitProjectName=${gitName%.git}
}

# Verifies that we know the information to connect to GitLab, either
# by pulling it from the current environment or by pulling it from
# the current projects "git remote" setting. Exits if we can't get
# the connection info through either means
validate_gitlab_env_vars () {
    if [[ -z "$gitRepoDomain" ]]; then

        set_gitlab_env_vars_from_remote_origin

        if [[ -z "$gitRepoDomain" ]]; then
            displayIssue "Failed to read GitLab repository details from local \".git\" configurations." "error"
            displayIssue "To fix this, either configure a remote Git origin for this project with the Git CLI"
            displayIssue "or set and export the following variables into the shell and retry:"
            displayIssue "    gitRepoDomain, gitProjectGroup, gitProjectName"
            exit 1
        fi
    else 
        get_env_var_value "gitRepoDomain" 1> /dev/null || exit 1
        get_env_var_value "gitProjectGroup" 1> /dev/null || exit 1
        get_env_var_value "gitProjectName" 1> /dev/null || exit 1
    fi

    gitLabProjectsApiUrl="https://$gitRepoDomain/api/v4/projects/$gitProjectGroup%2f$gitProjectName"
    gitLabEnvironmentsApiUrl="$gitLabProjectsApiUrl/environments"
    gitLabVarsApiUrl="$gitLabProjectsApiUrl/variables"
    gitLabMirrorsApiUrl="$gitLabProjectApiUrl/remote_mirrors"
}

confirm_gitlab_repo_exists () {
    if [[ -z "$gitLabToken" ]]; then
        ask_gitlab_token gitLabToken
    fi

    validate_gitlab_env_vars

    log "Checking if GitLab repository exists...\n"

    local fullConfirmCmd="$curlCommand -L --write-out '%{http_code}' --silent --output /dev/null \
    --request GET --header \"PRIVATE-TOKEN: ${gitLabToken}\" \
    \"$gitLabProjectsApiUrl\""

    log "${fullConfirmCmd/"$gitLabToken"/masked}"

    local repoCheckResponseCode=$(eval "$fullConfirmCmd")

    if [[ "$repoCheckResponseCode" != "200" ]]; then
        displayIssue "$gitProjectGroup/$gitProjectName does not appear to be a valid GitLab project" "error"
        return 1
    fi
}

# Retrieves GitLab environment names as a space-delimited string
# param1: the Bash nameref variable to set with the GitLab environment names
# param2: the GitLab access token to use in the request
get_gitlab_environment_names () {

    log "\nGetting GitLab environment names..."
    validate_gitlab_env_vars

    local -n envNameRef=$1
    local gitLabToken=$2
    ask_gitlab_token gitLabToken

    if [[ -z "$gitLabToken" ]]; then
        displayIssue "you must supply a GitLab token to retrieve GitLab environment names" "error"
        return 1
    fi
    
    local fullGetEnvsCmd="$curlCommand \
        --request GET --header \"PRIVATE-TOKEN: ${gitLabToken}\" \
        -s -w \"\n%{http_code}\" \
        \"${gitLabEnvironmentsApiUrl}\""

    local response="$(eval $fullGetEnvsCmd)"

    local responseHttpCode=$(tail -n1 <<< "$response") # get the last line
    local jsonResponse=$(sed '$ d' <<< "$response")    # get all but the last line which contains the status code

    log "\nHTTP Response Code: $responseHttpCode Response: $jsonResponse\n"

    if [[ "$responseHttpCode" == "200" ]]; then
        envNameRef=$(echo $jsonResponse | jq -r '[.[].name] | join(" ")')
    else
        displayIssue "HTTP response code from GitLab environment lookup was ${responseHttpCode}" "error"
    fi
}

# Pulls application environment variables from GitLab and
# saves them in the local .environment.json file.
# param1: optional - GitLab token
pull_env_vars_from_gitlab_to_local_json () {
    validate_gitlab_env_vars

    local gitLabToken=$1
    ask_gitlab_token gitLabToken

    if [[ -z "$gitLabToken" ]]; then
        displayIssue "you must supply a GitLab token to retrieve GitLab environment variables" "error"
        exit 1
    fi

    # Make a request that will return response headers, response code, and response body
    local perPage=100

    local fullPage1Command="$curlCommand --globoff \
        --request GET --header \"PRIVATE-TOKEN: ${gitLabToken}\" \
        -s -w \"\n%{http_code}\" -i \
        \"${gitLabVarsApiUrl}?per_page=${perPage}&page=1\""

    log "\nLooking up page 1 of GitLab environment variables for the \"$ENV_NAME\" environment...\n"
    log "GitLab variable lookup URL: $gitLabVarsApiUrl\n"

    local response="$(eval $fullPage1Command)"

    log "\n$response\n"

    # get "x-total-pages" response header value
    local totalPages=$(echo "$response" | grep -m1 ^x-total-pages | sed 's/^x-total-pages: //')
    totalPages=${totalPages%%[[:space:]]}

    log "GitLab environment values - totalPages is \"$totalPages\"\n"

    # Strip all response headers from the response
    # The response body comes after a blank line
    response=$(echo "$response" | sed -e '1,/^\r$/d')

    local responseHttpCode=$(tail -n1 <<< "$response") # get the last line
    local jsonResponse=$(sed '$ d' <<< "$response")    # get all but the last line which contains the status code

    # log "HTTP Response Code: $responseHttpCode Response: $jsonResponse"

    if [[ "$responseHttpCode" == "200" ]]; then

        # GitLab paginates responses so we may need multiple requests
        local requestCount
        for (( requestCount=1; requestCount < totalPages; requestCount++ )); do

            log "MAKING ANOTHER REQUEST"

            local pageUrl=$(echo "${gitLabVarsApiUrl}?per_page=${perPage}&page=$((requestCount+1))")
            
            log "\npageUrl is $pageUrl\n"

            # Won't return response headers
            local fullNextPageCommand="$curlCommand --globoff \
            --request GET --header \"PRIVATE-TOKEN: ${gitLabToken}\" \
            -s -w \"\n%{http_code}\" \
            \"$pageUrl\""

            local simpleResponse="$(eval $fullNextPageCommand)"

            local simpleResponseHttpCode=$(tail -n1 <<< "$simpleResponse") # get the last line
            local simpleJsonResponse=$(sed '$ d' <<< "$simpleResponse")    # get all but the last line which contains the status code

            log "Subsequent request response code: $simpleResponseHttpCode"
            log "$simpleJsonResponse\n"

            # Append the existing response array with the new response array
            if [[ "$simpleResponseHttpCode" == "200" ]]; then
                jsonResponse=$(echo -e "${jsonResponse}\n${simpleJsonResponse}" | jq -s 'add')
            else
                displayIssue "HTTP response code from GitLab environment variable lookup was ${simpleResponseHttpCode}" "error"
                exit 1
            fi
            
        done

        log "Fitering GitLab response to get only the configs for the \"$ENV_NAME\" environment."

        # Filter objects in the response that do not match the current environment
        # and write the variable values out to a JSON file
        echo $jsonResponse | jq --arg ENV_NAME "$ENV_NAME" '[.[] | select((.environment_scope==$ENV_NAME) or (.key|startswith("SONAR_")))]' | jq '. |= map( { (.key) : .value } ) | add' > $CPA_ENV_VAR_FILE_NAME
    else
        displayIssue "HTTP response code from GitLab environment variable lookup was ${responseHttpCode}" "error"
        exit 1
    fi
}

# Adds a push mirror setting for upstream repo to push to CodeCommit.
# param1: ARN of secret that contains info for connecting to CodeCommit
register_push_mirror () {
    local secretArn=$1

    validate_gitlab_env_vars

    if [[ "$gitRepoDomain" =~ "gitlab" ]]; then
        display "\n${CYAN}Attempting to register CodeCommit push mirror...${NC}"
        
        local gitLabToken
        ask_gitlab_token gitLabToken

        if [[ -z "$gitLabToken" ]]; then
            display "${YELLOW}GitLab access token not found. Skipping push mirror registration.${NC}"
            return 0
        fi

        # Parse info out of secret value
        local secretVal=$(aws secretsmanager get-secret-value --secret-id $secretArn --output json | jq --raw-output '.SecretString')
        local apiRepoUrl=$(echo "$secretVal" | jq -r '.apiRepoUrl')
        # URL encoding for password:
        apiRepoUrl=${apiRepoUrl//+/%2B} # replace any "+" since its not valid in a URL
        apiRepoUrl=${apiRepoUrl//=/%3D} # replace any "=" since its not valid in a URL
        local repoName="${apiRepoUrl##*\/}" # example result: "myrepo.git"

        # List current push mirrors for the upstream repo
        local fullMirrorCmd="$curlCommand -s -w \"\n%{http_code}\" --globoff --header \"PRIVATE-TOKEN: $gitLabToken\" \"${gitLabMirrorsApiUrl}\""
        local listResponse=$(eval $fullMirrorCmd)
        
        local listResponseHttpCode=$(tail -n1 <<< "$listResponse") # get the last line
        local listJsonResponse=$(sed '$ d' <<< "$listResponse")    # get all but the last line which contains the status code

        if [[ "$listResponseHttpCode" == 200 ]]; then
            local mirrorUrls=$(echo $listJsonResponse | jq -r '[.[].url] | join(" ")')
            if [[ "$mirrorUrls" == *"$repoName"* ]]; then
                display "${CYAN}$repoName has already been registered as a push mirror for the $gitProjectGroup/$gitProjectName repo.${NC}"
                return 0
            fi
        else
            displayIssue "Failed to retrieve existing upstream repo mirrors" "error"
            displayIssue "  Check that the GitLab access token is valid and has the correct permissions."
            displayIssue "  HTTP Code: $listResponseHttpCode Response: $listJsonResponse"
            displayIssue "Failed to register CodeCommit push mirror." "error"
            return 0
        fi

        # Register push mirror repo
        local fullCreateMirrorCmd="$curlCommand -s -w \"\n%{http_code}\" --globoff \
        --request POST --header \"PRIVATE-TOKEN: ${gitLabToken}\" \
        \"${gitLabMirrorsApiUrl}\" \
        --data \"url=${apiRepoUrl}&enabled=true&keep_divergent_refs=false\""

        local response=$(eval $fullCreateMirrorCmd)

        local responseHttpCode=$(tail -n1 <<< "$response") # get the last line
        local jsonResponse=$(sed '$ d' <<< "$response")    # get all but the last line which contains the status code

        if [[ "$responseHttpCode" != 201 ]]; then
            displayIssue "failed to register CodeCommit push mirror \"$repoName\"" "error"
            displayIssue "  HTTP Code: $responseHttpCode Response: $jsonResponse"
        else
            display "${CYAN}Successfully registered CodeCommit push mirror \"$repoName\"${NC}\n"
        fi
        
    else
        display "${YELLOW}WARN: automatic CodeCommit push mirror registration currently only supports GitLab repositories.${NC}\n"
    fi

}

# Sets the required environment variables for starting a SonarQube analysis from GitLab CICD
# Requires Maintainer privileges on the GitLab repo and a personal access token
# param1: required. the value of the SONAR_TOKEN
# param2: optional. the GitLab personal access token
set_gitlab_sonarqube_vars () {
    display "\n${CYAN}Saving SonarQube analysis parameters to GitLab CICD...${NC}"

    SONAR_TOKEN="$1"
    [ -z "$SONAR_TOKEN" ] && displayIssue "SonarQube project token is required as the first argument to the set_gitlab_sonarqube_vars function" "error" \
    && exit 1

    gitLabToken="$2"
    ask_gitlab_token gitLabToken
    if [[ -z "$gitLabToken" ]]; then
        display "Skipping setting SonarQube vars into GitLab."
        exit 0
    fi

    validate_gitlab_env_vars

    confirm_gitlab_repo_exists || return 1

    local sonarVarNames="SONAR_TOKEN SONAR_HOST_URL SONAR_PROJECT_KEY"
    local envScope="*"
    local varName
    local envVarValue
    local masked
    
    for varName in $sonarVarNames; do

        if [[ "$varName" == "SONAR_TOKEN" ]]; then
            masked="true"
            envVarValue="$SONAR_TOKEN"
        else
            masked="false"
            envVarValue="$(get_env_var_value $varName)"
        fi

        if [[ -z "$envVarValue" ]]; then
            displayIssue "No value found for $varName" "error"
            continue
        fi

        display "\nPosting $varName to $gitLabVarsApiUrl"

        display "\nCreating $varName with scope=$envScope, masked=$masked"

        local fullCreateSonarTokenEnvVarCmd="$curlCommand -s -w \"\n%{http_code}\" --globoff \
        --request POST --header \"PRIVATE-TOKEN: ${gitLabToken}\" \
        \"${gitLabVarsApiUrl}?filter[environment_scope]=$ENV_NAME\" \
        --form \"key=$varName\" \
        --form \"value=$envVarValue\" \
        --form \"protected=false\" \
        --form \"masked=$masked\" \
        --form \"environment_scope=$envScope\""

        local debugCmd="${fullCreateSonarTokenEnvVarCmd/"$gitLabToken"/masked}"
        if [[ "$masked" == "true" ]] && [[ ! -z "$envVarValue" ]]; then
            debugCmd="${debugCmd/"$envVarValue"/maskedVal}"
        fi
        log "\n$debugCmd\n"

        local response=$(eval $fullCreateSonarTokenEnvVarCmd)

        local responseHttpCode=$(tail -n1 <<< "$response") # get the last line
        local jsonResponse=$(sed '$ d' <<< "$response")    # get all but the last line which contains the status code

        if [[ "$responseHttpCode" != 201 ]]; then
            display "Could not create $varName. $jsonResponse"
            display "Trying to update $varName instead..."

            local fullUpdateVarCmd="$curlCommand -s -w \"\n%{http_code}\" --globoff \
            --request PUT --header \"PRIVATE-TOKEN: ${gitLabToken}\" \
            \"${gitLabVarsApiUrl}/$varName?filter[environment_scope]=$envScope\" \
            --form \"value=$envVarValue\" \
            --form \"protected=false\" \
            --form \"masked=$masked\" \
            --form \"environment_scope=$envScope\""

            local updateResponse=$(eval $fullUpdateVarCmd)

            local updateResponseHttpCode=$(tail -n1 <<< "$updateResponse") # get the last line
            local updateJsonResponse=$(sed '$ d' <<< "$updateResponse")    # get all but the last line which contains the status code

            if [[ "$updateResponseHttpCode" != 200 ]];
            then
                displayIssue "could not create or update $varName with environment_scope ${envScope}" "error"
                displayIssue "  HTTP Code: $updateResponseHttpCode Response: $updateJsonResponse"
            else
                display "Updated $varName"
            fi

        fi

    done

    display "\n${CYAN}Finished saving SonarQube analysis parameters to GitLab CICD${NC}\n"
}

# Sets environment variables for CICD pipelines on GitLab
# Requires Maintainer privileges on the GitLab repo and an access token
# param1 - optional. The GitLab token
set_gitlab_cicd_vars_for_env () {
    display "\n${CYAN}Saving environment variable settings using GitLab${NC}\n"

    local gitLabToken="$1"
    ask_gitlab_token gitLabToken
    if [[ -z "$gitLabToken" ]]; then
        display "Skipping setting GitLab environment variables for the \"$ENV_NAME\" environment."
        return 0
    fi

    validate_gitlab_env_vars

    confirm_gitlab_repo_exists || return 1

    # Check for gitlab environment, and create it if it is not found
    local envNames
    get_gitlab_environment_names envNames $gitLabToken
    local envExists="n"
    if [[ " ${envNames} " =~ " ${ENV_NAME} " ]]; then
        envExists="y"
    fi

    if [[ "$envExists" != "y" ]]; then
        create_gitlab_cicd_environment $gitLabToken || exit 1
    fi

    display "\nPosting environment variables to $gitLabVarsApiUrl"
    display "environment_scope is $ENV_NAME"

    for i in ${!ENV_KEYS[@]}; do
        local varName=${ENV_KEYS[$i]}

        if [[ "$CPA_DYNAMIC_ONLY" == "y" ]] && [[ ! -v "LOOKUPS[$varName]" ]]; then
            log "CPA_DYNAMIC_ONLY enabled, skipping $varName"
            continue
        fi

        # check that the env var value can be retrieved or exit if not
        # special syntax needed to get exit code status from local variables
        local envVarValue; envVarValue=$(get_env_var_value $varName) || exit 1

        if [[ "$CPA_CLEAR_DYNAMIC" == "y" ]] && [[ -v "LOOKUPS[$varName]" ]]; then
            log "CPA_CLEAR_DYNAMIC enabled, setting $varName to \"blank\""
            envVarValue="blank"
        fi
        
        local masked
        # Only certain values can be masked
        # See https://gitlab.com/help/ci/variables/index#mask-a-cicd-variable
        if [[ " ${CLEAR_TEXT_ENV_KEYS[*]} " =~ " ${varName} " ]]; then
            masked="false"
        else
            [[ "$envVarValue" =~ ^[a-zA-Z0-9+\/@:.~-]{8,}$ ]] && masked="true" || masked="false"
        fi
        
        if [[ "$varName" == "SONAR_TOKEN" ]]; then
            masked="true"
        fi

        local envScope
        if [[ "$varName" == SONAR_* ]]; then
            envScope="*"
        else
            envScope="$ENV_NAME"
        fi

        display "\nCreating $varName with scope=$envScope, masked=$masked"

        local fullCreateEnvVarCmd="$curlCommand -s -w \"\n%{http_code}\" --globoff \
        --request POST --header \"PRIVATE-TOKEN: ${gitLabToken}\" \
        \"${gitLabVarsApiUrl}?filter[environment_scope]=$ENV_NAME\" \
        --form \"key=$varName\" \
        --form \"value=$envVarValue\" \
        --form \"protected=false\" \
        --form \"masked=$masked\" \
        --form \"environment_scope=$envScope\""

        local debugCmd="${fullCreateEnvVarCmd/"$gitLabToken"/masked}"
        if [[ "$masked" == "true" ]] && [[ ! -z "$envVarValue" ]]; then
            debugCmd="${debugCmd/"$envVarValue"/maskedVal}"
        fi
        log "\n$debugCmd\n"

        local response=$(eval $fullCreateEnvVarCmd)

        local responseHttpCode=$(tail -n1 <<< "$response") # get the last line
        local jsonResponse=$(sed '$ d' <<< "$response")    # get all but the last line which contains the status code

        if [[ "$responseHttpCode" != 201 ]]; then
            display "Could not create $varName. $jsonResponse"
            display "Trying to update $varName instead..."

            local fullUpdateVarCmd="$curlCommand -s -w \"\n%{http_code}\" --globoff \
            --request PUT --header \"PRIVATE-TOKEN: ${gitLabToken}\" \
            \"${gitLabVarsApiUrl}/$varName?filter[environment_scope]=$envScope\" \
            --form \"value=$envVarValue\" \
            --form \"protected=false\" \
            --form \"masked=$masked\" \
            --form \"environment_scope=$envScope\""

            debugCmd="${fullUpdateVarCmd/"$gitLabToken"/masked}"
            if [[ "$masked" == "true" ]] && [[ ! -z "$envVarValue" ]]; then
                debugCmd="${debugCmd/"$envVarValue"/maskedVal}"
            fi
            log "\n$debugCmd\n"

            local updateResponse=$(eval $fullUpdateVarCmd)

            local updateResponseHttpCode=$(tail -n1 <<< "$updateResponse") # get the last line
            local updateJsonResponse=$(sed '$ d' <<< "$updateResponse")    # get all but the last line which contains the status code

            if [[ "$updateResponseHttpCode" != 200 ]]; then
                displayIssue "could not create or update $varName with environment_scope ${envScope}" "error"
                displayIssue "  HTTP Code: $updateResponseHttpCode Response: $updateJsonResponse"
            else
                display "Updated $varName"
            fi

        fi

    done

    display "\n${CYAN}Done posting environment variables to $gitLabVarsApiUrl\n${NC}"

}

# Deletes the current environment's variables from GitLab CICD
# Does NOT delete the GitLab environment itself
# param1: optional - the GitLab token
delete_gitlab_cicd_vars_for_env () {
    # ensure that environment variables needed by this function are set
    get_env_var_value "ENV_NAME" 1> /dev/null || exit 1
    validate_gitlab_env_vars
    
    local deleteSure
    display ""
    yes_or_no deleteSure "Are you sure you want to delete GitLab CICD variables for environment \"${ENV_NAME}\"?" "n"

    if [[ "$deleteSure" != "y" ]]; then
        return 0
    fi

    local gitLabToken=$1
    ask_gitlab_token gitLabToken

    if [[ -z "$gitLabToken" ]]; then
        display "Skipping deleting GitLab CICD environment variables"
        exit 0
    fi

    if [[ -z "$gitRepoDomain" ]]; then
        set_git_env_vars_from_remote_origin
    fi

    confirm_gitlab_repo_exists || return 1

    display "\nDeleting GitLab \"$ENV_NAME\" environment variables from $gitLabVarsApiUrl"

    for i in ${!ENV_KEYS[@]}; do
        local varName=${ENV_KEYS[$i]}

        
        # check that the env var value can be retrieved or exit if not
        # special syntax needed for getting exit code from local variable
        local envVarValue; envVarValue=$(get_env_var_value $varName) || exit 1
        
        display "\nDeleting $varName ..."

        local fullDeleteVarCmd="$curlCommand -s -w \"\n%{http_code}\" --globoff \
        --request DELETE --header \"PRIVATE-TOKEN: ${gitLabToken}\" \
        \"${gitLabVarsApiUrl}/$varName?filter[environment_scope]=$ENV_NAME\""

        local response=$(eval $fullDeleteVarCmd)

        local responseHttpCode=$(tail -n1 <<< "$response") # get the last line
        local jsonResponse=$(sed '$ d' <<< "$response")    # get all but the last line which contains the status code

        if [[ "$responseHttpCode" == 204 ]];
        then
            display "Deleted"
        elif [[ "$responseHttpCode" == 404 ]];
        then
            display "\"$varName\" was not configured as a GitLab CICD \"$ENV_NAME\" environment variable"
        else
            display "Deletion not successful. HTTP Response Code: $responseHttpCode Response: $jsonResponse"
        fi

    done

    display "\nDone deleting \"$ENV_NAME\" environment variables from GitLab CICD."
}

# Deletes the current environment from GitLab
# Does NOT delete GitLab CICD environment variables, just deletes the environment
# param1: optional - the GitLab token
delete_gitlab_cicd_environment () {
    # ensure that environment variables needed by this function are set
    get_env_var_value "ENV_NAME" 1> /dev/null || exit 1
    validate_gitlab_env_vars
    
    local deleteSure
    display ""
    yes_or_no deleteSure "Are you sure you want to delete GitLab CICD \"${ENV_NAME}\" environment?" "n"
    display ""

    if [[ "$deleteSure" != "y" ]]; then
        return 0
    fi

    local gitLabToken=$1
    ask_gitlab_token gitLabToken
    
    if [[ -z "$gitLabToken" ]]; then
        display "Skipping deleting GitLab CICD environment"
        exit 0
    fi

    if [[ -z "$gitRepoDomain" ]]; then
        set_git_env_vars_from_remote_origin
    fi

    confirm_gitlab_repo_exists || return 1

    local fullGevEnvForDeleteCmd="$curlCommand \
        --request GET --header \"PRIVATE-TOKEN: ${gitLabToken}\" \
        -s -w \"\n%{http_code}\" \
        \"${gitLabEnvironmentsApiUrl}\""

    local response="$(eval $fullGevEnvForDeleteCmd)"

    local responseHttpCode=$(tail -n1 <<< "$response") # get the last line
    local jsonResponse=$(sed '$ d' <<< "$response")    # get all but the last line which contains the status code

    if [[ "$responseHttpCode" == "200" ]]; then
        local envId=$(echo $jsonResponse | jq -r --arg ENV_NAME "$ENV_NAME" '.[] | select(.name==$ENV_NAME).id')
    else
        displayIssue "HTTP response code from GitLab environment lookup was ${responseHttpCode}" "error"
    fi

    if [[ -z "$envId" ]]; then
        display "INFO: No GitLab environment with name \"$ENV_NAME\" was found."
        return 0
    fi

    local gitLabEnvUrl="${gitLabProjectsApiUrl}/environments/${envId}/stop"
    display "Stopping GitLab \"${ENV_NAME}\" environment at $gitLabEnvUrl"
    
    local fullStopEnvCmd="$curlCommand \
        --request POST --header \"PRIVATE-TOKEN: ${gitLabToken}\" \
        -s -w \"\n%{http_code}\" \
        \"${gitLabEnvUrl}\""

    local response="$(eval $fullStopEnvCmd)"

    responseHttpCode=$(tail -n1 <<< "$response") # get the last line
    jsonResponse=$(sed '$ d' <<< "$response")    # get all but the last line which contains the status code

    if [[ "$responseHttpCode" != 200 ]]; then
        displayIssue "could not stop GitLab environment \"$ENV_NAME\"." "error"
        displayIssue "HTTP Response Code: $responseHttpCode - Response - $jsonResponse"
        exit 1
    else
        display "GitLab environment \"$ENV_NAME\" was successfully stopped"
    fi

    gitLabEnvUrl="${gitLabProjectsApiUrl}/environments/${envId}"
    display "\nDeleting GitLab \"${ENV_NAME}\" environment at $gitLabEnvUrl"
    
    local fullDeleteEnvCmd="$curlCommand \
        --request DELETE --header \"PRIVATE-TOKEN: ${gitLabToken}\" \
        -s -w \"\n%{http_code}\" \
        \"${gitLabEnvUrl}\""

    local response="$(eval $fullDeleteEnvCmd)"

    local responseHttpCode=$(tail -n1 <<< "$response") # get the last line
    local jsonResponse=$(sed '$ d' <<< "$response")    # get all but the last line which contains the status code

    if [[ "$responseHttpCode" != 204 ]]; then
        displayIssue "could not delete GitLab environment \"$ENV_NAME\"." "error"
        displayIssue "HTTP Response Code: $responseHttpCode - Response - $jsonResponse"
    else
        display "GitLab environment \"$ENV_NAME\" was successfully deleted"
    fi
}

# Creates an environment in the GitLab repository
# Does NOT create GitLab CICD environment variables, just creates the environment
create_gitlab_cicd_environment () {
    # ensure that environment variables needed by this function are set
    get_env_var_value "ENV_NAME" 1> /dev/null || exit 1
    validate_gitlab_env_vars
    
    local gitLabToken=$1
    ask_gitlab_token gitLabToken
    
    if [[ -z "$gitLabToken" ]]; then
        display "Skipping creating GitLab CICD environment"
        exit 0
    fi

    display "Creating \"$ENV_NAME\" environment on GitLab..."

    if [[ -z "$gitRepoDomain" ]]; then
        set_git_env_vars_from_remote_origin
    fi

    confirm_gitlab_repo_exists || return 1

    local fullCreateEnvCmd="$curlCommand \
        --request POST --header \"PRIVATE-TOKEN: ${gitLabToken}\" \
        -s -w \"\n%{http_code}\" \
        --data \"name=$ENV_NAME\" \
        \"${gitLabEnvironmentsApiUrl}\""

    local response="$(eval $fullCreateEnvCmd)"

    local responseHttpCode=$(tail -n1 <<< "$response") # get the last line
    local jsonResponse=$(sed '$ d' <<< "$response")    # get all but the last line which contains the status code

    if [[ "$responseHttpCode" != "201" ]]; then
        displayIssue "HTTP response code from GitLab environment creation was ${responseHttpCode}" "error"
        exit 1
    else
        display "Successfully created \"$ENV_NAME\" environment on GitLab!"
    fi
}
