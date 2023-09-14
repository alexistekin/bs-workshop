import * as cdk from "aws-cdk-lib";
import { Construct } from "constructs";
import * as eks from "aws-cdk-lib/aws-eks"
import { AADEnvironmentParams } from "@aws-app-development/common-constructs";
import { rules } from "cdk-nag";

export interface AADEKSNamespacesprops extends cdk.StackProps{
readonly aadEnv: AADEnvironmentParams;

/**
 * name of namespaces to create
*/
namespacesName: string
/**
 * Cluster
 */
cluster:eks.Cluster

}

export class AADEKSNamespaces extends Construct{
  constructor(parent: Construct, name: string, props: AADEKSNamespacesprops){
    super(parent,name);

    const envIdentifier = `${props.aadEnv.prefix.toLowerCase()}-${props.aadEnv.envName}`;

    props.cluster.addManifest( `${envIdentifier}-${props.namespacesName}`, {
      apiVersion: 'v1',
      kind: 'Namespace',
      metadata: { name: props.namespacesName },
    });

  }
}
