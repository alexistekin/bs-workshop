// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

import * as cdk from "aws-cdk-lib";
import * as iam from "aws-cdk-lib/aws-iam";
import * as kms from "aws-cdk-lib/aws-kms";
import * as ssm from "aws-cdk-lib/aws-ssm";
import { Construct } from "constructs";
import { AADEnvironmentParams } from "@aws-app-development/common-constructs";

/* eslint-disable @typescript-eslint/no-empty-interface */
export interface EKSProvisioningConstructProps extends cdk.StackProps {
  readonly aadEnv: AADEnvironmentParams;
  KMSkey: kms.IKey;
  // eksCollection: eks.ICluster[];
  assumedBy: string;
  auditTable: string;
}

const defaultProps: Partial<EKSProvisioningConstructProps> = {};

export class EKSBaseRoleConstructConstruct extends Construct {
  public IAMRole: iam.Role;
  public provisioningRoleParam:ssm.StringParameter;
  public provisioningRoleArnParam:ssm.StringParameter;

  constructor(parent: Construct, name: string, props: EKSProvisioningConstructProps) {
    super(parent, name);

    /* eslint-disable @typescript-eslint/no-unused-vars */
    props = { ...defaultProps, ...props };

    const envIdentifier = `${props.aadEnv.prefix.toLowerCase()}-${props.aadEnv.envName}`;
    const envPathIdentifier = `/${props.aadEnv.prefix.toLowerCase()}/${props.aadEnv.envName.toLowerCase()}`;

    // Create Iam role
    this.IAMRole = new iam.Role(this, `${envIdentifier}-role`, {
      assumedBy:  new iam.ArnPrincipal(props.assumedBy),
      roleName: name,
      managedPolicies: [
        iam.ManagedPolicy.fromAwsManagedPolicyName("AmazonEC2ContainerRegistryFullAccess"),
        iam.ManagedPolicy.fromAwsManagedPolicyName("CloudWatchFullAccess"),
        iam.ManagedPolicy.fromAwsManagedPolicyName("AWSCloudFormationFullAccess"),
        iam.ManagedPolicy.fromAwsManagedPolicyName("IAMFullAccess"),
        iam.ManagedPolicy.fromAwsManagedPolicyName("AmazonS3FullAccess"),
        iam.ManagedPolicy.fromAwsManagedPolicyName("AmazonSSMReadOnlyAccess")
      ],
      maxSessionDuration: cdk.Duration.seconds(43200),
    });
    this.IAMRole.grantAssumeRole(new iam.AccountRootPrincipal)

    // Add Secret and SSM access
    this.IAMRole.addToPolicy(
      new iam.PolicyStatement({
          actions: [
          "secretsmanager:CreateSecret",
          "secretsmanager:GetSecretValue",
          "secretsmanager:PutSecretValue",
          "secretsmanager:UpdateSecret",
          "secretsmanager:TagResource",
          ],
        effect: iam.Effect.ALLOW,
        resources: [`arn:aws:secretsmanager:*:${props.aadEnv.awsAccount}:secret:*`],
      })
    );


    // Bucket creation and tagging and reading for serverless deployments
    this.IAMRole.addToPolicy(
      new iam.PolicyStatement({
          actions: [
          "s3:CreateBucket",
          "s3:PutBucketTagging"
          ],
        effect: iam.Effect.ALLOW,
        resources: ["*"],
        conditions:{
          "StringEquals": {
            "aws:ResourceAccount": props.aadEnv.awsAccount
        }}
      })
    );

    this.IAMRole.addToPolicy(
      new iam.PolicyStatement({
          actions: [
          "s3:GetObject",
          "s3:GetObjectAttributes"
          ],
        effect: iam.Effect.ALLOW,
        resources: ["arn:aws:s3:::*/packaged.yaml"],
        conditions:{
          "StringEquals": {
            "aws:ResourceAccount": props.aadEnv.awsAccount
        }}
      })
    );

    // Add resource group access
    this.IAMRole.addToPolicy(
      new iam.PolicyStatement({
        actions: [
          "resource-groups:ListGroupResources",
          "resource-groups:Tag",
          "resource-groups:DeleteGroup"
        ],
        effect: iam.Effect.ALLOW,
        resources: [`arn:aws:resource-groups:*:${ props.aadEnv.awsAccount}:group/*`],
      })
    );

    this.IAMRole.addToPolicy(
      new iam.PolicyStatement({
        actions: ["tag:GetResources",
                  "eks:DescribeCluster",
                  "eks:CreateCluster",
                  "eks:CreateFargateProfile",
                  "eks:DeleteCluster",
                  "eks:DescribeCluster",
                  "eks:DescribeUpdate",
                  "eks:TagResource",
                  "eks:UntagResource",
                  "eks:UpdateClusterConfig",
                  "eks:UpdateClusterVersion",
                  "eks:DeleteFargateProfile",
                  "eks:DescribeFargateProfile",
                ],
        effect: iam.Effect.ALLOW,
        resources: ["*"],
      })
    );

    this.IAMRole.addToPolicy(
      new iam.PolicyStatement({
        actions:[
          "ec2:DescribeDhcpOptions",
          "ec2:DescribeInstances",
          "ec2:DescribeNetworkInterfaces",
          "ec2:DescribeRouteTables",
          "ec2:DescribeSecurityGroups",
          "ec2:DescribeSubnets",
          "ec2:DescribeVpcs",
          "ec2:AuthorizeSecurityGroupIngress",
          "ec2:AuthorizeSecurityGroupEgress",
          "ec2:RevokeSecurityGroupIngress",
          "ec2:RevokeSecurityGroupEgress"
        ]
      })
    )

    this.IAMRole.addToPolicy(
      new iam.PolicyStatement({
        actions: ["kms:Decrypt"],
        effect: iam.Effect.ALLOW,
        resources: [props.KMSkey.keyArn],
      })
    );


    this.IAMRole.addToPolicy(
      new iam.PolicyStatement({
        actions: ["eks:DescribeTaskDefinition", "eks:RegisterTaskDefinition"],
        effect: iam.Effect.ALLOW,
        resources: ["*"], 
      })
    );
      
    // Write Audit access
    this.IAMRole.addToPolicy(
      new iam.PolicyStatement({
        actions: [
          "dynamodb:List*",
          "dynamodb:DescribeStream",
          "dynamodb:DescribeTable",
          "dynamodb:Put*",
        ],
        effect: iam.Effect.ALLOW,
        resources: [`arn:aws:dynamodb:*:${props.aadEnv.awsAccount}:${props.auditTable}`],
      })
    );

    // allow creation of a Resource Group to track application resources via tags
    this.IAMRole.addToPolicy(
      new iam.PolicyStatement({
        actions: [
          "resource-groups:CreateGroup"
        ],
        effect: iam.Effect.ALLOW,
        resources: ["*"],  // CreateGroup does not support resource-level permissions and requires a wildcard
      })
    );
      
     // now save the Role in SSM Param
     const roleParam = new ssm.StringParameter(this, `${envIdentifier}-role-param`, {
      allowedPattern: ".*",
      description: `The Provisioning Role for AAD Solution: ${props.aadEnv.envName} Environment`,
      parameterName: `${envPathIdentifier}/provisioning-role`,
      stringValue: this.IAMRole.roleName,
    });

    const roleArnParam = new ssm.StringParameter(this, `${envIdentifier}-role-arn-param`, {
      allowedPattern: ".*",
      description: `The Provisioning Role Arn for AAD Solution: ${props.aadEnv.envName} Environment`,
      parameterName: `${envPathIdentifier}/provisioning-role-arn`,
      stringValue: this.IAMRole.roleArn,
    });

    this.provisioningRoleParam = roleParam;
    this.provisioningRoleArnParam = roleArnParam;


  }
  
}
