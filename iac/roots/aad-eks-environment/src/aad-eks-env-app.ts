#!/usr/bin/env node

// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

import * as cdk from "aws-cdk-lib";
import "source-map-support/register";
import { AADEKSEnvStack } from "./aad-eks-environment-stack";
import { makeRandom,AADEnvironmentParams } from "@aws-app-development/common-constructs";

function eksMandatory(propertyName: string) {
  if (!process.env[propertyName])
    throw new Error(`${propertyName} Environment variable is missing and mandatory for EKS environment`);
}

/**
 * Main application function, make it async so it can call asnyc functions properly.
 */
async function main() {
  const app = new cdk.App();

  console.log("Loading Configurations for EKS Environment...");

  const account = process.env.AWS_ACCOUNT_ID as string;
  const region = process.env.AWS_DEFAULT_REGION as string;
  const awsRegion = process.env.AWS_DEFAULT_REGION as string || "us-east-1"
  const envName = process.env.ENV_NAME as string
  const awsAccount = process.env.AWS_ACCOUNT_ID as string
  const prefix = process.env.PREFIX as string || "aad";
  const cidrInput = process.env.ENV_CIDR as string || "10.0.0.0/16"

  const aadEnvParams: AADEnvironmentParams = {
    envName: envName,
    awsRegion: awsRegion,
    awsAccount: awsAccount,
    prefix: prefix
  }
  const envIdentifier = aadEnvParams.envName;
  const env = { region, account };

  eksMandatory("ENV_NAME");
  eksMandatory("AWS_ACCOUNT_ID");
  eksMandatory("PLATFORM_ROLE_ARN");
  eksMandatory("SSM_PIPELINE_ROLE_ARN");
  // eksMandatory("ENV_CIDR")

  // generate unique environment identifier
  const envID = makeRandom(4);
  console.log("Generating unique Environment identifier for EKS environment: " + envID);


    // Deploying EKS cluster
    new AADEKSEnvStack(app, `${aadEnvParams.prefix}-${envIdentifier}-eks-cluster`,{
      uniqueEnvIdentifier:envID
    })

    

  app.synth();
}

main();
