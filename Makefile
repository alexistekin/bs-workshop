# // Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
# // SPDX-License-Identifier: Apache-2.0


build-backstage:  ## Builds the backstage frontend and backend app
	./build-script/build-backstage.sh

deploy-backstage:
	./build-script/deploy-backstage.sh

test:
	./build-script/hello-world.sh

push-backstage-reference-repo:
	./build-script/gitlab-tools.sh
	
pce:
	./build-script/utility-functions.sh print_current_environment
