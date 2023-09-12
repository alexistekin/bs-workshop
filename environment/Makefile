SHELL := /usr/bin/env bash -euo pipefail -c
ENV_MKFILE_PATH := $(abspath $(lastword $(MAKEFILE_LIST)))
ENV_PATH := $(dir $(ENV_MKFILE_PATH))
IGNORE := $(shell bash -c "$(ENV_PATH)utility-functions.sh cpa_hooks \"$(MAKECMDGOALS)\"")
include $(ENV_PATH)make-env

# List all Make targets in alphabetical order
.PHONY: list
list:
	@LC_ALL=C $(MAKE) -pRrq -f $(firstword $(MAKEFILE_LIST)) : 2>/dev/null | awk -v RS= -F: '/(^|\n)# Files(\n|$$)/,/(^|\n)# Finished Make data base/ {if ($$1 !~ "^[#.]") {print $$1}}' | sort | egrep -v -e '^[^[:alnum:]]' -e '^$@$$'

##@ Create PACE App
# Wizard to create a new or update an existing application environment
# Takes an optional "f" parameter if you want to pass an environment
# JSON file in that has all the settings. Passing in a JSON file puts
# the wizard in "headless" mode, where it won't ask any questions 
# usage: 
#   make create-environment
#   OR
#   make create-environment f=<pathToEnvironmentJsonFile>
create-environment: ## create a new or update an existing application environment (alias: ce)
	@$(ENV_PATH)create-app-environment.sh "$(f)"

# Simple create-environment shortcut
ce:
	@$(MAKE) create-environment f="$(f)"

# Wizard to delete an application environment
delete-environment: ## delete an application environment (alias: de)
	@$(ENV_PATH)delete-app-environment.sh

# Simple delete-environment shortcut
de: delete-environment

# Presents choice of which local environment to set as the current one
switch-current-environment:  ## Choose a local environment and switch to it (alias: sce)
	@$(ENV_PATH)utility-functions.sh switch_local_environment

# Simple switch-current-environment shortcut
sce: switch-current-environment

# Print the current local environment
get-current-environment: ## Print the current local environment (alias: gce)
	@$(ENV_PATH)utility-functions.sh get_current_env

# Simple get-current-environment shortcut
gce: get-current-environment

# Print the current local environments
list-local-environments: ## List the current local environments (alias: lle)
	@$(ENV_PATH)utility-functions.sh get_local_environment_names

# Simple list-local-environments shortcut
lle: list-local-environments

# Print the current remote environments
list-remote-environments: ## List the current remote environments (alias: lre)
	@$(ENV_PATH)utility-functions.sh get_remote_environment_names

# Simple list-remote-environments shortcut
lre: list-remote-environments

# Print all environment setting name-value pairs for easy confirmation
# of whether your environment is configured correctly
print-current-environment:  ## Print current env name-value pairs (alias: pce)
	@$(ENV_PATH)utility-functions.sh print_current_environment

# Simple print-current-environment shortcut
pce: print-current-environment

# Get current CPA environment variable exports to paste into your shell
export-current-environment:  ## Get current CPA environment variable exports to paste into your shell (alias: ece)
	@$(ENV_PATH)utility-functions.sh echo_export_local_app_env_vars

# Simple export-current-environment shortcut
ece: export-current-environment

# Resolve placeholders in a file and print the result to the console
# usage: make print-resolved-template-file f=<filePath>
print-resolved-template-file:  ## Resolve placeholders in a file and print the result (alias: prt)
	@echo ""
	@echo "Note: set \"DYNAMIC_RESOLUTION\" environment variable to \"y\" to enable dynamic resolution"
	@echo ""
	@$(ENV_PATH)utility-functions.sh print_resolved_placeholders "$(f)"

# Simple print-resolved-template-file shortcut
prt:
	@echo ""
	@echo "Note: set \"DYNAMIC_RESOLUTION\" environment variable to \"y\" to enable dynamic resolution"
	@echo ""
	@$(ENV_PATH)utility-functions.sh print_resolved_placeholders "$(f)"

# Prints the names of all application code files that contain environment variable
# lookups for langauges such as Python, JavaScript, and Java
# Takes an optional "d" parameter if you want to specifiy the starting directory
# in which to search for files that contain placeholders
# usage: 
#   make list-code-template-files
#   OR
#   make list-code-template-files d=<pathToDirectory>
list-code-template-files:  ## List app code files containing env var lookups (alias: lctf)
	@$(ENV_PATH)utility-functions.sh list_code_template_files "$(d)"

# Simple list-code-template-files shortcut
lctf: 
	@$(MAKE) list-code-template-files

# Prints the names of all application files that contain environment placeholders.
# Takes an optional "d" parameter if you want to specifiy the starting directory
# in which to search for files that contain placeholders
# usage: 
#   make list-template-files
#   OR
#   make list-template-files d=<pathToDirectory>
list-template-files:  ## List app files containing env placeholders (alias: ltf)
	@$(ENV_PATH)utility-functions.sh get_template_files "$(d)"

# Simple list-template-files shortcut
ltf: 
	@$(MAKE) list-template-files d="$(d)"

# Validates all application templates to ensure that all placeholders
# in all templates can be successfully resolved
validate-template-files:  ## Validate application templates (alias: vtf)
	@$(ENV_PATH)utility-functions.sh resolve_template_files "dryRun"

# Simple validate-template-files shortcut
vtf: validate-template-files

# Resolves placeholders in all application template files and
# overwrites the files with the resolved content
# WARNING - will leave template files in a changed state
# Takes an optional "d" parameter if you want to specifiy the starting directory
# in which to search for files that contain placeholders
# usage: 
#   make resolve-template-files
#   OR
#   make resolve-template-files d=<pathToDirectory>
resolve-template-files:  ## Resolves placeholders in app template files (alias: rtf)
	@$(ENV_PATH)utility-functions.sh resolve_template_files "" "$(d)"

# Simple resolve-template-files shortcut
rtf: $(MAKE) resolve-template-files

# Resolves placeholders in all application template files and
# overwrites the files with the resolved content
# A backup of each template is taken before the resolution process
# to allow for undoing the resolve step later
# WARNING - will leave template files in a changed state
# Takes an optional "d" parameter if you want to specifiy the starting directory
# in which to search for files that contain placeholders
# usage: 
#   make backup-resolve-template-files
#   OR
#   make backup-resolve-template-files d=<pathToDirectory>
backup-resolve-template-files:  ## Resolves placeholders in template files with backups (alias: brtf)
	@$(ENV_PATH)utility-functions.sh resolve_template_files "backup" "$(d)"

# Simple backup-resolve-template-files shortcut
brtf: $(MAKE) backup-resolve-template-files

# Restores template file backups. This serves as an "undo" for the
# files that were changed by "resolve-template-files"
# Takes an optional "d" parameter if you want to specifiy the starting directory
# in which to search for files that contain placeholders
# usage: 
#   make restore-backup-files
#   OR
#   make restore-backup-files d=<pathToDirectory>
restore-backup-files:  ## Restores template files from backups (alias: rbf)
	@$(ENV_PATH)utility-functions.sh restore_template_files "$(d)"

# Simple restore-backup-files shortcut
rbf: 
	$(MAKE) restore-backup-files

# extract-deliverable wizard that will extract application files that we want to share into a separate directory
# Takes an optional "b" parameter if you want to specifiy the branch to clone
# usage: 
#   make extract-deliverable
#   OR
#   make extract-deliverable b=<myBranchName>
extract-deliverable:  ## Extracts app files to share externally (alias: exd)
	@$(ENV_PATH)extract-deliverable.sh "$(b)"

# Simple extract-deliverable shortcut
exd: extract-deliverable

# Presents choice of remote environments to import and set as the current one
pull-env-vars:  ## Lists remote environments and sets current env
	@$(ENV_PATH)utility-functions.sh pull_env_vars

# Save off local environment variable settings to a remote store e.g. SSM or GitLab.
# This is useful to make it so that your team members or a CICD pipeline can reference
# environment variable values
# Takes an optional "gitRepoToken" parameter if you want to specifiy the git repository token
# usage: 
#   make push-env-vars
#   OR
#   make push-env-vars gitRepoToken=<myToken>
push-env-vars:  ## Saves local env var settings to remote store (SSM or Gitlab)
	@$(ENV_PATH)utility-functions.sh push_env_vars "$(gitRepoToken)"

# Prints a table of CloudTrail logs for IAM permission denied events
# over a date range. Useful for debugging IAM role permissions errors.
list-auth-errors:  ## Prints CloudTrail logs for IAM permission denied events (alias: lae)
	@$(ENV_PATH)utility-functions.sh print_auth_errors

# Simple list-auth-errors shortcut
lae: list-auth-errors

# Execute a utility-function on the current environment
# If you do not supply the "f" argument, the utility function names will be printed out
# usage: make util f=<functionName>
util:
	@echo "Current environment is \"$(ENV_NAME)\""
	$(ENV_PATH)utility-functions.sh "$(f)"

# Registers this project with SonarQube
create-sonarqube-project:
	@$(ENV_PATH)utility-functions.sh create_sonarqube_project

# Creates a new project token on SonarQube
create-sonarqube-project-token:
	@$(ENV_PATH)utility-functions.sh create_sonarqube_project_token

# Pushes SonarQube Analysis Parameters to GitLab
# Requires sonar project token to be supplied as the first argument
# Optionally, the GitLab personal access token can be supplied as the second argument
# usage: make push-sonarqube-info-to-gitlab sonarProjectToken=<sonarProjectTokenValue> gitLabToken=<gitLabTokenValue>
push-sonarqube-info-to-gitlab:
	@$(ENV_PATH)utility-functions.sh set_gitlab_sonarqube_vars "$(sonarProjectToken)" "$(gitLabToken)"

# cicd: Resolves all environment variables in template files, executes "cdk deploy" 
# for the cicd module, then restores template files to their original content
deploy-cicd:
	$(ENV_PATH)utility-functions.sh exec_cdk_for_env cicd

# cicd: Resolves all environment variables in template files, executes "cdk destroy"
# for the cicd module, then restores template files to their original content
destroy-cicd:
	CDK_MODE=destroy $(ENV_PATH)utility-functions.sh exec_cdk_for_env cicd

# Executes cdk bootstrap against the current environment's AWS account for the
# AWS_DEFAULT_REGION
# You can supply an optional region argument to deploy the CDK stack to the region
# of your choice.
# usage: 
#   make deploy-cdk2-bootstrap-cf-stack
#   OR
#   make deploy-cdk2-bootstrap-cf-stack region=<myChosenAWSRegion>
deploy-cdk2-bootstrap-cf-stack:
	@$(ENV_PATH)utility-functions.sh deploy_cdk_bootstrap_cf_stack "$(region)"

# Executes cloudformation delete-stack against the current environment's AWS 
# account for the AWS_DEFAULT_REGION
destroy-cdk2-bootstrap-cf-stack:
	@$(ENV_PATH)utility-functions.sh destroy_cdk_bootstrap_cf_stack

##@ AAD Infrastructure Tasks
# Resolves all environment variables in template files, executes "cdk deploy" 
# for the AADStack, then restores template files to their original content
deploy-platform: ## Deploys the platform CDK stack
	$(ENV_PATH)utility-functions.sh exec_cdk_for_env aad-platform
	@echo Enabling IMDSv2 for the Gitlab Host EC2 instance
	./build-script/set-imdsv2.sh

deploy-ecs-env:
	$(ENV_PATH)utility-functions.sh exec_cdk_for_env aad-ecs-environment "--outputs-file output/cdk-output.json"

# Resolves all environment variables in template files, executes "cdk destroy"
# for the AADStack stack, then restores template files to their original content
destroy-platform:  ## Destroys the platform CDK stack
	$(ENV_PATH)utility-functions.sh validate_aws_cli_account
	./build-script/update-backstage-service-count.sh 0 || true
	./build-script/delete-backstage-s3-log-bucket.sh
	CDK_MODE=destroy $(ENV_PATH)utility-functions.sh exec_cdk_for_env aad-platform

synth-platform: ## Deploys the platform CDK stack
	CDK_MODE=synth $(ENV_PATH)utility-functions.sh exec_cdk_for_env aad-platform

synth-ecs: ## Deploys the platform CDK stack
	CDK_MODE=synth $(ENV_PATH)utility-functions.sh exec_cdk_for_env aad-ecs-environment

synth-eks: ## Deploys the platform CDK stack
	CDK_MODE=synth $(ENV_PATH)utility-functions.sh exec_cdk_for_env aad-eks-environment