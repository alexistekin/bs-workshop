#!/usr/bin/env bash

scriptDir=$( cd -- "$( dirname -- "${BASH_SOURCE[0]}" )" &> /dev/null && pwd )
source $scriptDir/helpers.sh

# backstage-cli --version ;
cd $backstageDir
# build the plugin packages and create dist folder ready for publication
yarn tsc
yarn build:all
cd plugins
npm login
npm publish --workspaces
# update version identifiers in source control so that future work is against a new version
npm version patch --workspaces
# --workspaces --dry-run
