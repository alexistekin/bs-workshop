import * as cdk from 'aws-cdk-lib';
import { randomUUID as uuid } from 'crypto';
import { EKSNoteAppStack } from "./cdk-eks-module-stack";

const app = new cdk.App();

const account = app.node.tryGetContext("account") || process.env.CDK_DEPLOY_ACCOUNT || process.env.CDK_DEFAULT_ACCOUNT;

const region =
  app.node.tryGetContext("region") || process.env.CDK_DEPLOY_REGION || process.env.CDK_DEFAULT_REGION || "us-east-1";

const env = { region, account };

const appShortName = app.node.tryGetContext('ENV_NAME')
const stackName = "aad-eks-app-${{ values.component_id }}" ;

new EKSNoteAppStack(app, stackName, {
  stackName: stackName,
  env });

app.synth()