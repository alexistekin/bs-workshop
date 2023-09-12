# // Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
# // SPDX-License-Identifier: Apache-2.0

-include environment/Makefile
-include Makefile.*
export

##@ Local Tasks

clean:  ## deletes generated files and dependency modules
	./build-script/clean.sh

clean-dist:
	@echo "cleaning build artifacts"
	(rm -rf dist/)

build-dist: clean-dist
	@echo "building archive for deliverable artifacts"
	(mkdir dist)
	./build-script/build-dist.sh

yarn-install:  ## Initialize your local development environment
	./build-script/npm-install.sh

build-backstage:  ## Builds the backstage frontend and backend app
	./build-script/build-backstage.sh

deploy-backstage:
	./build-script/deploy-backstage.sh

build: ## Init entire project 
	$(MAKE) yarn-install
	$(MAKE) build-backstage

backstage-install: ## install base backstage app and dependency modules
	$(MAKE) yarn-install
	. ./build-script/backstage-install.sh
	$(MAKE) yarn-install

##@ Local Debugging
start-local:  ## Start the backstage app for local development
	. ./build-script/local-runners.sh; start_local

start-local-debug:  ## Start the backstage app for local development with debugging enabled
	. ./build-script/local-runners.sh; start_local_debug

stop-local:  ## Stop all running processes for local development
	. ./build-script/local-runners.sh; stop_local

push-backstage-reference-repo:
	. ./build-script/gitlab-tools.sh

##@ CDK Tasks
bootstrap:  ## Bootstrap the CDK in an AWS account
	@echo "Bootstrap CDK account for backstage.IO"
	cd infrastructure; \
	node_modules/aws-cdk/bin/cdk bootstrap -c region=$(REGION); \
	cd -
	@echo "Bootstrap Finished."

build-and-deploy-backstage-image: build-backstage deploy-backstage

help:  ## Show help message
	@awk 'BEGIN {FS = ": .*##"; printf "\nUsage:\n  make \033[36m<target>\033[0m\n"} /^[$$()% 0-9a-zA-Z_-]+(\\:[$$()% 0-9a-zA-Z_-]+)*:.*?##/ { gsub(/\\:/,":", $$1); printf "  \033[36m%-30s\033[0m %s\n", $$1, $$2 } /^##@/ { printf "\n\033[1m%s\033[0m\n", substr($$0, 5) } ' $(MAKEFILE_LIST)



# Deploy EKS Cluster
deploy-eks-cluster: 
	./build-script/eks-cluster-deployment.sh

