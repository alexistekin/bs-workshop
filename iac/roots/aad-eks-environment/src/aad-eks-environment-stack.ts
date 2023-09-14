// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

import * as cdk from "aws-cdk-lib";
import { Construct } from "constructs";
import * as ec2 from "aws-cdk-lib/aws-ec2";
import * as kms from "aws-cdk-lib/aws-kms";
import * as ssm from "aws-cdk-lib/aws-ssm";
import * as iam from "aws-cdk-lib/aws-iam";
import * as eks from "aws-cdk-lib/aws-eks";
import {AADEKSNamespaces} from "./constructs/eks-env-namespaces"
import { AADEKSClusterConstruct } from "./constructs/eks-env-cluster-construct";
import { EKSControlPlaneRoleConstruct } from "./constructs/eks-env-control-plane-role";
import { EKSOperationsConstruct } from "./constructs/eks-env-operations-role-construct";
import { EKSProvisioningConstruct } from "./constructs/eks-env-provisioning-role-construct";
import { AADEnvironmentParams, NetworkConstruct, DynamoDBConstruct  } from "../../aad-common-constructs";
import cluster from "cluster";


export interface AADEKSEnvStackProps extends cdk.StackProps {
  uniqueEnvIdentifier: string;
}

export class AADEKSEnvStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props: AADEKSEnvStackProps) {
    super(scope, id, props);

    const prefix = (process.env.PREFIX as string) || "aad";
    const envName = process.env.ENV_NAME as string;
    const cidrInput = process.env.ENV_CIDR as string || "10.0.0.0/16";
    const awsAccount = process.env.AWS_ACCOUNT_ID as string;
    const platformRoleArn = process.env.PLATFORM_ROLE_ARN as string;
    const pipelineRoleArn = process.env.SSM_PIPELINE_ROLE_ARN as string;
    const awsRegion = (process.env.AWS_DEFAULT_REGION as string) || "us-east-1";
    const teamNamespace = process.env.TEAM_NAMESPACE as string
    const eksNamespaces =["pace","csa"]

    const aadEnvParams: AADEnvironmentParams = {
      envName: envName,
      awsRegion: awsRegion,
      awsAccount: awsAccount,
      prefix: prefix,
    };

    const envIdentifier = aadEnvParams.envName;
    const envPathIdentifier = `/${envIdentifier}`;

    // EKS VPC and supporting resources
    console.log("...Creating eks cluster networking resources");
    const eksNetwork = new NetworkConstruct(this, envIdentifier, {
      aadEnv: aadEnvParams,
      cidrRange: cidrInput,
      isIsolated: false,
      publicVpcNatGatewayCount: 3,
      vpcAzCount: 3,
    });

    // Create encryption key for audit table data at rest encryption
    console.log("...Creating kms key for audit table ");
    const key = new kms.Key(this, `${envIdentifier}-key`, {
      alias: `${envIdentifier}-key`,
      enableKeyRotation: true,
      removalPolicy: cdk.RemovalPolicy.DESTROY,
      pendingWindow: cdk.Duration.days(8),
    });

    // Save KMS key arn in an SSM Parameter
    new ssm.StringParameter(this, `${envIdentifier}-key-param`, {
      allowedPattern: ".*",
      description: `The KMS Key for EKS Solution: ${envIdentifier} Environment`,
      parameterName: `${envPathIdentifier}/kms-key`,
      stringValue: key.keyArn,
    });

    // create audit table
    console.log("...Creating dynamodb audit table audit table ");
    const auditTableConstruct = new DynamoDBConstruct(this, "audit-table", {
      aadEnv: aadEnvParams,
      tableName: `${envIdentifier}-audit`,
      kmsKey: key,
    });

    // save the unique environment identifier
    const uniqueEnvId = new ssm.StringParameter(this, `${envIdentifier}-unique-id-param`, {
      allowedPattern: ".*",
      description: `The Unique ID for: ${aadEnvParams.envName} Environment`,
      parameterName: `${envPathIdentifier}/unique-id`,
      stringValue: props.uniqueEnvIdentifier,
    });



    // Create pipeline provisioning role for the environment

    const provisioningRole = new EKSProvisioningConstruct(
      this,
      `${aadEnvParams.prefix}-${envIdentifier}-provisioning-role`,
      {
        aadEnv: aadEnvParams,
        KMSkey: key,
        // eksCollection: [stack.getClusterInfo().cluster],
        assumedBy: pipelineRoleArn,
        auditTable: auditTableConstruct.table.tableName,
      }
    );
  

    // Create operations role for the environment
    const operationsRoleConstruct = new EKSOperationsConstruct(
      this,
      `${aadEnvParams.prefix}-${envIdentifier}-operations-role`,
      {
        aadEnv: aadEnvParams,
        KMSkey: key,
        // eksCollection: [stack.getClusterInfo().cluster],
        assumedBy: platformRoleArn,
        auditTable: auditTableConstruct.table.tableName,
      }
    );


    //creating cluster control plane role and casting type
    const clusterControlPlaneRole = new EKSControlPlaneRoleConstruct(this,`${aadEnvParams.prefix}-${envIdentifier}-cluster-control-plane-role`,{
      aadEnv:aadEnvParams
    } ) 

    const eksMasterNodeSG= new ec2.SecurityGroup(this, `${aadEnvParams.prefix}-${envIdentifier}-eks-cluster-sg`,{
      vpc: eksNetwork.vpc,
      securityGroupName: `${aadEnvParams.prefix}-${envIdentifier}-eks-cluster-sg`,
      description: "EKS created security group applied to ENI that is attached to EKS Control Plane master nodes, as well as any managed workloads.",
      allowAllOutbound: true,

    });

    // Allow traffic to Cluster 
    // TODO scope down SG access 
    eksMasterNodeSG.addIngressRule(
      ec2.Peer.anyIpv4(),
      ec2.Port.allTraffic()
    )

    // Deploying EKS Cluster and using pipeline role as master role for the cluster
    const eksCluster = new AADEKSClusterConstruct(this, `${aadEnvParams.prefix}-${envIdentifier}-eks-cluster`, {
      privateCluster: false,
      aadEnv: aadEnvParams,
      clusterMasterRole: provisioningRole.IAMRole,
      role: clusterControlPlaneRole.IAMRole,
      securityGroup: eksMasterNodeSG,
      vpc: eksNetwork.vpc,
      teamRole: iam.Role.fromRoleArn(this, 'role,',`arn:aws:iam::${{awsAccount}}:role/Admin`), 
      user: iam.User.fromUserArn(this, "local-user",`arn:aws:iam::${{awsAccount}}:user/Admin`), //TODO this will need to be removed for production use cases
      namespacesNames: teamNamespace
    });

    for (let i = 0; i < eksNamespaces.length; i++) {
      new AADEKSNamespaces(this, `${aadEnvParams.prefix}-${envIdentifier}-${eksNamespaces[i]}`, {
        aadEnv: aadEnvParams,
        namespacesName:eksNamespaces[i],
        cluster: eksCluster.cluster,
      })
    };

    // quota is 10 fargate profile and up to 5 selectors is supported per fargate profile
    new eks.FargateProfile(this, 'MyProfile', {
      cluster: eksCluster.cluster,
      selectors: [ 
        { namespace: eksNamespaces[0] }, 
        { namespace: eksNamespaces[1] } 
      ],
    });

    new ssm.StringParameter(this, `${envIdentifier}-namespaces-param`, {
      allowedPattern: ".*",
      description: `Namespaces for EKS Solution: ${envIdentifier} Environment`,
      parameterName: `${envPathIdentifier}/eks-team-namespaces`,
      stringValue: JSON.stringify(eksNamespaces),

    });

    eksCluster.node.addDependency(provisioningRole);
    // Printing the environment name that was just created
    new cdk.CfnOutput(this, "EnvironmentName", {
      value: envName,
    });

    // Printing the unique environment ID
    new cdk.CfnOutput(this, "EnvironmentID", {
      value: uniqueEnvId.parameterName,
    });
  // Printing the unique VPC ID
  new cdk.CfnOutput(this, "VPC", {
    value: eksNetwork.vpcParam.parameterName,
  });

    // Printing the EKS Cluster name
    new cdk.CfnOutput(this, "ClusterName", {
      value:  eksCluster.clusterParameter.parameterName  //eksAppCluster.clusterParam.parameterName,
    });

    // Printing audit table
    new cdk.CfnOutput(this, "AuditTable", {
      value: auditTableConstruct.tableParam.parameterName,
    });

    new cdk.CfnOutput(this, "OperationsRoleARN", {
      value: operationsRoleConstruct.operationsRoleArnParam.parameterArn, // TODO check this outputs an iam role arn and not a ssm parameter arn
      description: " Role assumed by pipeline role to operate the cluster",
    });

    new cdk.CfnOutput(this, "ProvisioningRoleARN", {
      value: provisioningRole.provisioningRoleArnParam.parameterName,
      description: " This role is used to provision the cluster and is used as the cluster master role",
    });
  }
}
