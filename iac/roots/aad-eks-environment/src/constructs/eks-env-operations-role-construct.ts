// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

import * as cdk from "aws-cdk-lib";
import { Construct } from "constructs";
import * as iam from "aws-cdk-lib/aws-iam";
import * as kms from "aws-cdk-lib/aws-kms";
import * as ssm from "aws-cdk-lib/aws-ssm";
import { AADEnvironmentParams } from "@aws-app-development/common-constructs";

/* eslint-disable @typescript-eslint/no-empty-interface */
export interface EKSOperationsConstructProps extends cdk.StackProps {
  readonly aadEnv: AADEnvironmentParams;
  KMSkey: kms.IKey;
  assumedBy: string;
  auditTable: string;
}

const defaultProps: Partial<EKSOperationsConstructProps> = {};

export class EKSOperationsConstruct extends Construct {
  public IAMRole: iam.Role;
  public operationsRoleParam:ssm.StringParameter;
  public operationsRoleArnParam:ssm.StringParameter;

  constructor(parent: Construct, name: string, props: EKSOperationsConstructProps) {
    super(parent, name);

    /* eslint-disable @typescript-eslint/no-unused-vars */
    props = { ...defaultProps, ...props };

    const envIdentifier = `${props.aadEnv.prefix.toLowerCase()}-${props.aadEnv.envName}`;
    const envPathIdentifier = `/${props.aadEnv.prefix.toLowerCase()}/${props.aadEnv.envName.toLowerCase()}`;

    // Create Iam role
    this.IAMRole = new iam.Role(this, `${envIdentifier}-role`, {
      assumedBy: new iam.ArnPrincipal(props.assumedBy),
      roleName: name,
      managedPolicies: [
        iam.ManagedPolicy.fromAwsManagedPolicyName("AmazonEC2ContainerRegistryFullAccess"),
        iam.ManagedPolicy.fromAwsManagedPolicyName("CloudWatchFullAccess"),
        iam.ManagedPolicy.fromAwsManagedPolicyName("AmazonSSMReadOnlyAccess")
      ],
      maxSessionDuration: cdk.Duration.seconds(43200),
    });

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
      }),

      

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

    this.IAMRole.addToPolicy(
      new iam.PolicyStatement({
        actions: [
          "resource-groups:ListGroupResources"
        ],
        effect: iam.Effect.ALLOW,
        resources: [`arn:aws:resource-groups:*:${ props.aadEnv.awsAccount}:group/*`],
      })
    );

    this.IAMRole.addToPolicy(
      new iam.PolicyStatement({
        actions: ["tag:GetResources",
                ],
        effect: iam.Effect.ALLOW,
        resources: ["*"],
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
        ],
        effect: iam.Effect.ALLOW,
        resources: ["*"],
      })
    )

    this.IAMRole.addToPolicy(
      new iam.PolicyStatement({
        actions: [
          "dynamodb:Scan",
          "dynamodb:PutItem",
          ],
        effect: iam.Effect.ALLOW,
        resources: [`arn:aws:dynamodb:*:${props.aadEnv.awsAccount}:table/*`],
      })
    );

    this.IAMRole.addToPolicy(
      new iam.PolicyStatement({
        actions: ["kms:Decrypt",
      ],
        effect: iam.Effect.ALLOW,
        resources: [props.KMSkey.keyArn],
      })
    );

    this.IAMRole.addToPolicy(
      new iam.PolicyStatement({
        actions: ["eks:DescribeTaskDefinition", "eks:RegisterTaskDefinition"],
        effect: iam.Effect.ALLOW,
        // resources: [eks.clusterArn, eks.clusterArn + "/*"],
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
      description: `The Operations Role for AAD Solution: ${props.aadEnv.envName} Environment`,
      parameterName: `${envPathIdentifier}/operations-role`,
      stringValue: this.IAMRole.roleName,
    });

    const roleArnParam = new ssm.StringParameter(this, `${envIdentifier}-role-arn-param`, {
      allowedPattern: ".*",
      description: `The Operations Role Arn for AAD Solution: ${props.aadEnv.envName} Environment`,
      parameterName: `${envPathIdentifier}/operations-role-arn`,
      stringValue: this.IAMRole.roleArn,
    });

    // Post params to output
    new cdk.CfnOutput(this, "Operations Role Param", {
      value: roleParam.parameterName,
    });

    // Post params to output
    new cdk.CfnOutput(this, "Operations Role Arn Param", {
      value: roleArnParam.parameterName,
    });
    this.operationsRoleParam = roleParam;
    this.operationsRoleArnParam = roleArnParam;
  }
  
}
