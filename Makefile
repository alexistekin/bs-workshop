# // Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
# // SPDX-License-Identifier: Apache-2.0


build-backstage:  ## Builds the backstage frontend and backend app
	./build-script/build-backstage.sh

deploy-backstage:
	./build-script/deploy-backstage.sh

test:
	./build-script/hello-world.sh
