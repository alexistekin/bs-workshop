#!/usr/bin/env bash

# Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.

# Use this script to create an application milestone deliverable for sharing with others.
# For example, if we want to share a version 0.1 of our application code for someone
# else to look at, we can use this script to copy the sharable files into 
# a separate directory and remove any non-versioned files and directories, such as
# ".git", "node_modules" and ".terraform".

branchName=$1

if [[ -z "$branchName" ]]; then
    branchName="main"
fi

# Sets Bash nameref variable to "true" if the deliverable directory is valid or
# "false" otherwise
# param1: the deliverable parent directory path
# param2: the name of the deliverable-version directory (without path)
# param3: the nameref variable that will be set to "true" or "false"
is_valid_deliverable_dir () {
    local deliverableParentDir=$1
    local deliverableDir=${deliverableParentDir}$2
    local -n returnVar=$3
    returnVar="true"
    
    if [[ -z "$deliverableParentDir" ]]; then
        returnVar="false"
    elif [[ ! "$deliverableParentDir" == */ ]]; then
        displayIssue "The directory name must end with /"
        returnVar="false"
    elif [[ "$deliverableParentDir" == "${appRootDir}/" ]]; then
        displayIssue "The new deliverable must be created outside of the ${appRootDir} directory"
        returnVar="false"
    elif [[ ! -d "$deliverableDir" ]]; then
        :
    elif [[ "$(ls -A ${deliverableDir})" ]]; then
        displayIssue "\nThe deliverable directory \"$deliverableDir\" cannot already exist."
        returnVar="false"
    fi
}

# Sets Bash nameref variable to "true" if the clone directory is valid or
# "false" otherwise
# param1: the current application root parent directory
# param2: the clone parent directory path
# param2: the nameref variable that will be set to "true" or "false"
is_valid_clone_dir () {
    local appRootParentDir=$1
    local cloneDir=$2
    local -n returnVar=$3
    returnVar="true"
    
    if [[ -z "$cloneDir" ]]; then
        displayIssue "value is required" "error"
        returnVar="false"
    elif [[ "$appRootParentDir" == "$cloneDir" ]] || [[ "$appRootParentDir" == "$cloneDir/" ]]; then
        displayIssue "cannot clone to \"$appRootParentDir\" because the application already exists there." "error"
        returnVar="false"
    fi
}

# adds DELIVERABLE_NAME to global namespace
ask_deliverable_name () {
    display "\nThe deliverable version name must be unique. For example, it can be a"
    display "version number like \"1_0\" or a date like \"12_25_2022\".\n"
    today=$(date +%m-%d-%Y_%H-%M-%S)
    length_range DELIVERABLE_NAME "Enter the deliverable version name:" "$today" "1" "30"
}

scriptDir=$( cd -- "$( dirname -- "${BASH_SOURCE[0]}" )" &> /dev/null && pwd )
source $scriptDir/utility-functions.sh "source extract_deliverable_wizard" 1> /dev/null

display "\nWelcome to the Create Application Deliverable Wizard!"

validate_bash_version
appRootDir=$( cd -- "$( dirname -- "${BASH_SOURCE[0]}" )" &> /dev/null && cd .. &> /dev/null && pwd )
appName=${appRootDir##*/}
appRootParentDir=$( cd -- "$( dirname -- "${appRootDir}" )" &> /dev/null && pwd )
appRootParentDir=${appRootParentDir}/

isValidCloneDir="false"
display "\nThe safest way to ensure that unversioned files do not make it into your"
display "deliverable is to start with a fresh pull from the remote Git repository.\n"
yes_or_no freshPull "Do you want to pull a fresh copy of the Git repository to a separate local directory" "y"

if [[ "$freshPull" == "y" ]]; then

    while [[ $isValidCloneDir == "false" ]]; do
        display ""
        defaultCloneDir="${appRootParentDir}pure-git-clones"
        length_range freshPullDir "Enter the path of the directory that will store the freshly pulled files from Git:" \
        "$defaultCloneDir" "1" "150"
        is_valid_clone_dir "$appRootParentDir" "$freshPullDir" isValidCloneDir
    done

    display ""

    if [[ ! -d "$freshPullDir" ]]; then
        mkdir -p "$freshPullDir"
    fi

    if [[ "$freshPullDir" == */ ]]; then
        :
    else
        # make sure freshPullDir ends with /
        freshPullDir=${freshPullDir}/
    fi

    cd "$appRootDir"
    gitRemote=$(git remote get-url --push origin 2> /dev/null)

    if [[ ! -z "$gitRemote" ]]; then
        log "\ngitRemote is $gitRemote\n"
    else
        displayIssue "could not auto-detect git remote" "error"
        displayIssue "Configure the application's Git remote origin and try again"
        exit 1
    fi

    display "App name is ${appRootDir##*/}"

    cd "$freshPullDir"

    if [[ -d "$appName" ]]; then
        display "Deleting previous clone at ${freshPullDir}${appName}\n"
        rm -rf "${freshPullDir}${appName}"
    fi

    git clone $gitRemote
    if [[ ! -d "$appName" ]]; then
        displayIssue "\nfailed to clone Git repo at ${gitRemote}" "error"
        exit 1
    fi
    cd $appName
    git checkout $branchName
    rm -rf "${freshPullDir}${appName}/.git"
    
    appRootDir="${freshPullDir}${appName}"
    appRootParentDir="$freshPullDir"

fi

ask_deliverable_name

isValidDeliverableParentDir="false"
display ""
while [[ $isValidDeliverableParentDir == "false" ]]; do
    defaultParentDir="${appRootParentDir}customer-deliverables/${appName}/"
    length_range deliverableParentDir "Where should the \"$DELIVERABLE_NAME\" deliverable directory be created?" \
        "$defaultParentDir" "1" "150"
    is_valid_deliverable_dir "$deliverableParentDir" "$DELIVERABLE_NAME" isValidDeliverableParentDir
done

deliverablePath="${deliverableParentDir}${DELIVERABLE_NAME}"
mkdir -p "$deliverablePath"

includeEnv="n"
if [[ -d "${appRootDir}${projectEnvPath}" ]]; then 
    display ""
    yes_or_no includeEnv "Do you want to include the \"environment\" scripts" "n"
fi

if [[ "$includeEnv" == "y" ]]; then
    log "\nCopying ${appRootDir}${projectEnvPath} to $deliverablePath ..."
    rsync -av --progress ${appRootDir}${projectEnvPath} $deliverablePath --exclude '.*' --exclude '.log.txt' --exclude 'extract-deliverable.sh' --exclude 'temp-*' --exclude make-env --exclude '.DS_Store' | tee -a $projectEnvDir/.log.txt
    log ""

    match="initialChoiceVals=.*$"
    newVal="initialChoiceVals=\"\""
    # Clear initialChoiceVals 
    if [[ "$OSTYPE" == "darwin"* ]]; then
        sed -i '' "s|$match|$newVal|g" ${deliverablePath}${projectEnvPath}/create-app-environment.sh
    else
        sed -i "s|$match|$newVal|g" ${deliverablePath}${projectEnvPath}/create-app-environment.sh
    fi

fi

log "\nCopying ${appRootDir}${projectIacPath} to $deliverablePath ..."
rsync -av --progress ${appRootDir}${projectIacPath} $deliverablePath --exclude 'cicd' --exclude '*.bak' --exclude 'temp-*' \
--exclude '*node_modules' --exclude 'cdk.out' --exclude '.terraform*' --exclude '.DS_Store' | tee -a $projectEnvDir/.log.txt
log ""

includeCicd="n"
if [[ -d "${appRootDir}${projectCicdPath}" ]] || [[ -d "${appRootDir}${projectIacRootModulePath}${projectCicdPath}" ]]; then 
    display ""
    yes_or_no includeCicd "Do you want to include the CICD pipeline" "n"
fi

if [[ "$includeCicd" == "n" ]]; then
    log "\nCopying ${appRootDir}/ to $deliverablePath ..."
    rsync -av --progress ${appRootDir}/ $deliverablePath --exclude '*.bak' --exclude 'temp-*' --exclude '*node_modules' \
    --exclude '.git' --exclude 'cicd' --exclude 'environment' --exclude 'iac' \
    --exclude '.gitlab-ci*' --exclude sonar-project.properties | tee -a $projectEnvDir/.log.txt
    log ""

    rm -rf ${deliverablePath}${projectIacRootModulePath}${projectCicdPath}

    if [[ "$includeEnv" == "y" ]]; then
        # Remove references to CICD pipeline
        grep -vE "(Git|GIT|GitLab|GITLAB|gitlab|CICD|cicd|AWS_CREDS_TARGET_ROLE|SonarQube|SONAR)" ${deliverablePath}${projectEnvPath}/app-env-var-names.txt > tmpfile && mv tmpfile ${deliverablePath}${projectEnvPath}/app-env-var-names.txt
        
        grep -vE "(cicd|push-mirror|extract-deliverable|SonarQube|sonarqube)" ${deliverablePath}${projectEnvPath}/Makefile > tmpfile && mv tmpfile ${deliverablePath}${projectEnvPath}/Makefile
    fi

else
    log "\nCopying ${appRootDir}/ to $deliverablePath ..."
    rsync -av --progress ${appRootDir}/ $deliverablePath --exclude '*.bak' --exclude 'temp-*' --exclude '*node_modules' \
    --exclude '.git' --exclude 'cicd' --exclude 'environment' --exclude 'iac' --exclude '.DS_Store' | tee -a $projectEnvDir/.log.txt
    log ""

    if [[ -d "${appRootDir}${projectCicdPath}" ]]; then
        log "\nCopying ${appRootDir}${projectCicdPath} to $deliverablePath ..."
        rsync -av --progress ${appRootDir}${projectCicdPath} $deliverablePath --exclude '*.bak' --exclude 'temp-*' --exclude '.DS_Store' | tee -a $projectEnvDir/.log.txt
        log ""
    elif [[ -d "${appRootDir}${projectIacRootModulePath}${projectCicdPath}" ]]; then
        log "\nCopying ${appRootDir}${projectIacRootModulePath}${projectCicdPath} to $deliverablePath ..."
        rsync -av --progress ${appRootDir}${projectIacRootModulePath}${projectCicdPath} ${deliverablePath}${projectIacRootModulePath} \
        --exclude '*.bak' --exclude 'temp-*' --exclude '.terraform*' \
        --exclude '.DS_Store' | tee -a $projectEnvDir/.log.txt
        # --exclude 'code-commit-mirror.tf' --exclude 'gitlab-cicd-role.tf' \
        log ""
    fi
    
fi

if [[ "$includeEnv" == "y" ]]; then
    echo "blank" > ${deliverablePath}${projectEnvPath}/.current-environment
    log "Set ${deliverablePath}${projectEnvPath}/.current-environment contents to \"blank\".\n"
    log "Writing blank values to \"${deliverablePath}${projectEnvPath}/.environment-blank.json\" ...\n"
    ${deliverablePath}${projectEnvPath}/utility-functions.sh print_blank_app_env_vars_json > ${deliverablePath}${projectEnvPath}/.environment-blank.json
    
    log "${deliverablePath}${projectEnvPath}/.environment-blank.json Contents:"
    log "$(cat ${deliverablePath}${projectEnvPath}/.environment-blank.json)"
    log "\nprint_blank_app_env_vars_json logs:"
    log "$(cat ${deliverablePath}${projectEnvPath}/.log.txt)"
    log ""
    rm "${deliverablePath}${projectEnvPath}/.log.txt"
    log "Deleted ${deliverablePath}${projectEnvPath}/.log.txt\n"

    log "Setting ${deliverablePath}${projectEnvPath}/environment-constants.json to an empty object..."
    echo "{}" > "${deliverablePath}${projectEnvPath}/environment-constants.json"

    log "${deliverablePath}${projectEnvPath}/environment-constants.json Contents:"
    log "$(cat ${deliverablePath}${projectEnvPath}/environment-constants.json)"
fi

display "\n${GREEN}Congratulations! The deliverable files are available under \"$deliverablePath\"!${NC}\n"
