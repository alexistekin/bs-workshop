#!/usr/bin/env bash

scriptDir=$( cd -- "$( dirname -- "${BASH_SOURCE[0]}" )" &> /dev/null && pwd )
source $scriptDir/helpers.sh

echo "Initializing the infrastructure development environment"
cd $backstageIacDir
yarn install
cd -
echo "Initializing the backstage development environment"
cd $backstageDir
yarn install
yarn tsc
cd -
echo "Development environment initialization finished"