
import { Construct } from "constructs";
import * as ecr from "aws-cdk-lib/aws-ecr"
import * as kms from "aws-cdk-lib/aws-kms";
import * as rg from "aws-cdk-lib/aws-resourcegroups";
import { Stack, StackProps,RemovalPolicy, Tags, CfnOutput } from "aws-cdk-lib/core";

const StackVarNames = {
  appShortName: "APP_SHORT_NAME",
  vpcId: "TARGET_VPCID",
  clusterArn: "TARGET_EKS_CLUSTER_ARN",
  envName: "TARGET_ENV_NAME",
  envProviderName: "TARGET_ENV_PROVIDER_NAME",
};

export class EKSNoteAppStack extends Stack {
  constructor(scope: Construct, id: string, props?: StackProps) {
    super(scope, id, props);

    // Validate that required env vars are provided
    const appShortName = "${{ values.component_id }}";
    console.log("APP SHORT NAME:", appShortName)
    const vpcId = process.env[StackVarNames.vpcId];
    console.log (`VpcID is ${vpcId}`)
    const clusterArn = process.env[StackVarNames.clusterArn];
    const envName = process.env[StackVarNames.envName];
    const envProviderName = process.env[StackVarNames.envProviderName];
    if (!appShortName) {
      throw new Error("Required environment variable: appShortName was not provided.");
    }
    if (!vpcId) {
      throw new Error("Required environment variable: vpcId, was not provided.");
    }
    if (!clusterArn) {
      throw new Error("Required environment variable: clusterArn was not provided.");
    }

    const kmsKey = new kms.Key(this, "appKmsKey", {
      // alias: `${parameters.appShortName.valueAsString}-repo-key`,
      removalPolicy: RemovalPolicy.DESTROY,
      description: "Key used to encrypt note app repository"
    });

    const ecrRepository = new ecr.Repository(this, "aad-eks-note-app-ecr-repository", {
      repositoryName: `${appShortName}-${envProviderName}`.toLowerCase(),
      imageScanOnPush: true,
      encryption: ecr.RepositoryEncryption.KMS,
      encryptionKey: kmsKey,
      autoDeleteImages: true,
      removalPolicy: RemovalPolicy.DESTROY,
    });

    const tagKey = `aws-apps:${appShortName}`;
    Tags.of(this).add(tagKey, appShortName);

    // Add any tags passed as part of AWS_RESOURCE_TAGS input parameters
    const resourceTagsEnvVar = process.env.AWS_RESOURCE_TAGS;
    if (resourceTagsEnvVar) {
      const resourceTags = (JSON.parse(resourceTagsEnvVar) as Record<string, string>[]);
      resourceTags.forEach(tag => {
        Tags.of(this).add(tag.Key, tag.Value);
      });
    }

    const rscGroup = new rg.CfnGroup(this, `${appShortName}-resource-group`, {
      name: `${appShortName}-rg`,
      description: `Resource related to ${appShortName}`,
      resourceQuery: {
        type: "TAG_FILTERS_1_0",
        query: {
          resourceTypeFilters: ["AWS::AllSupported"],
          tagFilters: [
            {
              key: tagKey,
            },
          ],
        },
      },
    });

    // Output parameters
    new CfnOutput(this, "EcrRepositoryUri", {
      description: `The ECR repository Uri for ${appShortName}`,
      value: ecrRepository.repositoryUri,
    });
    new CfnOutput(this, "EcrRepositoryArn", {
      description: `The ECR repository Arn for ${appShortName}`,
      value: ecrRepository.repositoryArn,
    });

    new CfnOutput(this, "AppResourceGroup", {
      description: `The tag-based resource group to identify resources related to ${appShortName}`,
      value: `${rscGroup.attrArn}`,
    });

    new CfnOutput(this, `StackName`, {
      value: this.stackName,
      description: "The EKS App CF Stack name",
    });
    
    
  }
}

