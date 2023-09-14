#!/usr/bin/env node

// Copyright 2023 Amazon.com and its affiliates; all rights reserved.
// This file is Amazon Web Services Content and may not be duplicated or distributed without permission.
// SPDX-License-Identifier: MIT-0

import * as cdk from "aws-cdk-lib";
import "source-map-support/register";
import { getConfig } from "./utils/config";
import { CicdStack } from './cicd-stack';

/**
 * Main application function, make it async so it can call asnyc functions properly.
 */
async function main() {
    const app = new cdk.App();
    
    //Load config, when ready start the app
    console.log("Loading Configurations...");
    const config = await getConfig();
    console.log(JSON.stringify(config)); 
    console.log("DONE");

    if (!config) throw Error("Config not defined");

    cdk.Tags.of(app).add("App", config.appName);

    new CicdStack(app, `${config.appName}-${config.envName}-cicd`, {
        config,
        env: { account: config.awsAccountId, region: config.awsDefaultRegion }
    });

    app.synth();
}

main();
