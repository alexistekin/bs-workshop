// import * as cdk from "aws-cdk-lib";
import { CfnOutput, RemovalPolicy, Stack, StackProps, Tags } from "aws-cdk-lib";
import * as s3 from "aws-cdk-lib/aws-s3";
import * as rg from "aws-cdk-lib/aws-resourcegroups";
import { Construct } from "constructs";

// Environment variables that can be passed in and used in this stack
// The env var names must match the values passed in from scaffolder action(s) building this stack
const StackVarNames = {
  appShortName: "APP_SHORT_NAME",
  envName: "TARGET_ENV_NAME",
  envProviderName: "TARGET_ENV_PROVIDER_NAME",
};

export class ServerlessApiResourcesStack extends Stack {

  constructor(scope: Construct, id: string, props?: StackProps) {
    super(scope, id, props);

    // Validate that required env vars are provided
    const appShortName = "${{ values.component_id }}";
    const envName = process.env[StackVarNames.envName];
    const envProviderName = process.env[StackVarNames.envProviderName];
    if (!appShortName) {
      throw new Error("Required config: appShortName was not provided.");
    }
    if (!envName) {
      throw new Error(`Required environment variable: ${StackVarNames.envName}, was not provided.`);
    }
    if (!envProviderName) {
      throw new Error(`Required environment variable: ${StackVarNames.envProviderName} was not provided.`);
    }

    // Tag all resources so that they can be grouped together in a Resource Group
    // the prefix "aws-apps:" is a convention adopted for this implementation
    const tagKey = `aws-apps:${appShortName}-${envProviderName}`;
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
      name: `${appShortName}-${envProviderName}-rg`,
      description: `Resource related to ${appShortName} provided by ${envProviderName}`,
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

    const buildArtifactsBucket = new s3.Bucket(this, `${appShortName}-${envProviderName}-build-bucket`, {
      removalPolicy: RemovalPolicy.DESTROY,
      objectOwnership: s3.ObjectOwnership.OBJECT_WRITER,
      autoDeleteObjects: true,
      versioned: false,
      enforceSSL: true,
      encryption: s3.BucketEncryption.S3_MANAGED,
      blockPublicAccess: s3.BlockPublicAccess.BLOCK_ALL,
    });

    // Output parameters
    new CfnOutput(this, "AppResourceGroup", {
      description: `The tag-based resource group to identify resources related to ${appShortName}`,
      value: `${rscGroup.attrArn}`,
    });

    // print the stack name as a Cloudformation output
    new CfnOutput(this, `StackName`, {
      value: this.stackName,
      description: "The Serverless API Infrastructure CF Stack name",
    });

    new CfnOutput(this, "BuildBucketName", {
      description: `The name of the S3 bucket to hold build artifacts for ${appShortName} in ${envProviderName}`,
      value: `${buildArtifactsBucket.bucketName}`,
    });
  }

}
