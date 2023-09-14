import * as fs from "fs"
import * as cdk from "aws-cdk-lib";
import { Construct } from "constructs";
import * as kms from "aws-cdk-lib/aws-kms"
import * as eks from "aws-cdk-lib/aws-eks";
import * as iam from "aws-cdk-lib/aws-iam";
import * as ssm from "aws-cdk-lib/aws-ssm";
import * as ec2 from "aws-cdk-lib/aws-ec2";
import { KubectlV27Layer } from '@aws-cdk/lambda-layer-kubectl-v27';




import { AADEnvironmentParams } from "@aws-app-development/common-constructs";


export interface AADEKSClusterConstructProps extends cdk.StackProps{
  readonly aadEnv: AADEnvironmentParams;
  /**
   * make cluster public or private
   */
  privateCluster: boolean;
  /**
   * An IAM role that will be added to the system:masters Kubernetes RBAC group.
   * This role is Highly privileged and can only be accesed in cloudtrail through the CreateCluster api
   * upon cluster creation
   */
  clusterMasterRole: iam.Role
  /**
   * Role that provides permissions for the Kubernetes control 
   * plane to make calls to AWS API operations on your behalf.
   */
  role: iam.Role
  /**
   * Control Plane Security Group
   */
  securityGroup: ec2.SecurityGroup
  vpc : ec2.Vpc
/**
 * additional role to add to configmap at creation time
 */
  teamRole: iam.IRole
/**
 * additional users to add to configmap
 */
  user:iam.IUser

/**
 * name of namespaces to create
 */
namespacesNames: string

}

interface HelmValues {
  [key: string]: unknown;
}

const defaultProps: Partial<AADEKSClusterConstructProps> = {};

export class AADEKSClusterConstruct extends Construct{
  public readonly clusterParameter: ssm.StringParameter;
  public readonly cluster: eks.Cluster


  constructor(parent: Construct, name: string, props: AADEKSClusterConstructProps){
    super(parent,name);

    const envIdentifier = `${props.aadEnv.prefix.toLowerCase()}-${props.aadEnv.envName}`;
    const envPathIdentifier = `/${props.aadEnv.prefix.toLowerCase()}/${props.aadEnv.envName.toLowerCase()}`;

    // define if the cluster will be public or private
    const endpointAccess = (props.privateCluster === true) ? eks.EndpointAccess.PRIVATE : eks.EndpointAccess.PUBLIC_AND_PRIVATE;


    // define lambda layers
    const clusterKmsKey = new kms.Key(this, `${envIdentifier}-cluster-key`, {
      enableKeyRotation: false,
      alias: cdk.Fn.join('', ['alias/', 'eks/', `${envIdentifier}-cluster-key-alias`]),
    });
    // creating EKS Cluster
    console.log("...Creating EKS Cluster")
    const cluster = new eks.FargateCluster(this, `${envIdentifier}-Eks-cluster`, {
        version: eks.KubernetesVersion.V1_27,
        clusterLogging: [
          eks.ClusterLoggingTypes.API,
          eks.ClusterLoggingTypes.AUTHENTICATOR,
          eks.ClusterLoggingTypes.SCHEDULER,
        ],
        clusterName:`${envIdentifier}-eks-cluster`,
        endpointAccess: endpointAccess,
        mastersRole: props.clusterMasterRole,
        role: props.role,
        securityGroup: props.securityGroup,
        outputClusterName: true,
        outputConfigCommand: true,
        outputMastersRoleArn: true,
        vpc: props.vpc,
        // Ensure EKS helper lambadas are in private subnets
        placeClusterHandlerInVpc: true,
        secretsEncryptionKey: clusterKmsKey,   
        kubectlLayer: new KubectlV27Layer(this, 'kubectl'),
        
    });
    
    const awsLbControllerServiceAccount = cluster.addServiceAccount(
      'aws-load-balancer-controller',
      {
        name: 'aws-load-balancer-controller',
        namespace: 'kube-system'
      }
    );
    const lbAcmPolicyStatements = new iam.PolicyStatement({
      effect: iam.Effect.ALLOW,
      actions: [
        'acm:DescribeCertificate',
        'acm:ListCertificates',
        'acm:GetCertificate'
      ],
      resources: ['*']
    });

    const lbEc2PolicyStatements = new iam.PolicyStatement({
      effect: iam.Effect.ALLOW,
      actions: [
        'ec2:AuthorizeSecurityGroupIngress',
        'ec2:CreateSecurityGroup',
        'ec2:CreateTags',
        'ec2:DeleteTags',
        'ec2:DeleteSecurityGroup',
        'ec2:DescribeAccountAttributes',
        'ec2:DescribeAddresses',
        'ec2:DescribeInstances',
        'ec2:DescribeInstanceStatus',
        'ec2:DescribeInternetGateways',
        'ec2:DescribeNetworkInterfaces',
        'ec2:DescribeSecurityGroups',
        'ec2:DescribeSubnets',
        'ec2:DescribeTags',
        'ec2:DescribeVpcs',
        'ec2:ModifyInstanceAttribute',
        'ec2:ModifyNetworkInterfaceAttribute',
        'ec2:RevokeSecurityGroupIngress',
        'ec2:DescribeAvailabilityZones'
      ],
      resources: ['*']
    });

    const lbElbPolicyStatements = new iam.PolicyStatement({
      effect: iam.Effect.ALLOW,
      actions: [
        'elasticloadbalancing:AddListenerCertificates',
        'elasticloadbalancing:AddTags',
        'elasticloadbalancing:CreateListener',
        'elasticloadbalancing:CreateLoadBalancer',
        'elasticloadbalancing:CreateRule',
        'elasticloadbalancing:CreateTargetGroup',
        'elasticloadbalancing:DeleteListener',
        'elasticloadbalancing:DeleteLoadBalancer',
        'elasticloadbalancing:DeleteRule',
        'elasticloadbalancing:DeleteTargetGroup',
        'elasticloadbalancing:DeregisterTargets',
        'elasticloadbalancing:DescribeListenerCertificates',
        'elasticloadbalancing:DescribeListeners',
        'elasticloadbalancing:DescribeLoadBalancers',
        'elasticloadbalancing:DescribeLoadBalancerAttributes',
        'elasticloadbalancing:DescribeRules',
        'elasticloadbalancing:DescribeSSLPolicies',
        'elasticloadbalancing:DescribeTags',
        'elasticloadbalancing:DescribeTargetGroups',
        'elasticloadbalancing:DescribeTargetGroupAttributes',
        'elasticloadbalancing:DescribeTargetHealth',
        'elasticloadbalancing:ModifyListener',
        'elasticloadbalancing:ModifyLoadBalancerAttributes',
        'elasticloadbalancing:ModifyRule',
        'elasticloadbalancing:ModifyTargetGroup',
        'elasticloadbalancing:ModifyTargetGroupAttributes',
        'elasticloadbalancing:RegisterTargets',
        'elasticloadbalancing:RemoveListenerCertificates',
        'elasticloadbalancing:RemoveTags',
        'elasticloadbalancing:SetIpAddressType',
        'elasticloadbalancing:SetSecurityGroups',
        'elasticloadbalancing:SetSubnets',
        'elasticloadbalancing:SetWebAcl'
      ],
      resources: ['*']
    });

    const lbIamPolicyStatements = new iam.PolicyStatement({
      effect: iam.Effect.ALLOW,
      actions: [
        'iam:CreateServiceLinkedRole',
        'iam:GetServerCertificate',
        'iam:ListServerCertificates'
      ],
      resources: ['*']
    });

    const lbCognitoPolicyStatements = new iam.PolicyStatement({
      effect: iam.Effect.ALLOW,
      actions: ['cognito-idp:DescribeUserPoolClient'],
      resources: ['*']
    });

    const lbWafRegPolicyStatements = new iam.PolicyStatement({
      effect: iam.Effect.ALLOW,
      actions: [
        'waf-regional:GetWebACLForResource',
        'waf-regional:GetWebACL',
        'waf-regional:AssociateWebACL',
        'waf-regional:DisassociateWebACL'
      ],
      resources: ['*']
    });

    const lbTagPolicyStatements = new iam.PolicyStatement({
      effect: iam.Effect.ALLOW,
      actions: ['tag:GetResources', 'tag:TagResources'],
      resources: ['*']
    });

    const lbWafPolicyStatements = new iam.PolicyStatement({
      effect: iam.Effect.ALLOW,
      actions: ['waf:GetWebACL'],
      resources: ['*']
    });

    const lbWafv2PolicyStatements = new iam.PolicyStatement({
      effect: iam.Effect.ALLOW,
      actions: [
        'wafv2:GetWebACL',
        'wafv2:GetWebACLForResource',
        'wafv2:AssociateWebACL',
        'wafv2:DisassociateWebACL'
      ],
      resources: ['*']
    });

    const lbShieldPolicyStatements = new iam.PolicyStatement({
      effect: iam.Effect.ALLOW,
      actions: [
        'shield:DescribeProtection',
        'shield:GetSubscriptionState',
        'shield:DeleteProtection',
        'shield:CreateProtection',
        'shield:DescribeSubscription',
        'shield:ListProtections'
      ],
      resources: ['*']
    });

    awsLbControllerServiceAccount.addToPrincipalPolicy(lbAcmPolicyStatements);
    awsLbControllerServiceAccount.addToPrincipalPolicy(lbEc2PolicyStatements);
    awsLbControllerServiceAccount.addToPrincipalPolicy(lbElbPolicyStatements);
    awsLbControllerServiceAccount.addToPrincipalPolicy(lbIamPolicyStatements);
    awsLbControllerServiceAccount.addToPrincipalPolicy(lbCognitoPolicyStatements);
    awsLbControllerServiceAccount.addToPrincipalPolicy(lbWafRegPolicyStatements);
    awsLbControllerServiceAccount.addToPrincipalPolicy(lbTagPolicyStatements);
    awsLbControllerServiceAccount.addToPrincipalPolicy(lbWafPolicyStatements);
    awsLbControllerServiceAccount.addToPrincipalPolicy(lbWafv2PolicyStatements);
    awsLbControllerServiceAccount.addToPrincipalPolicy(lbShieldPolicyStatements);

    // Deploy AWS LoadBalancer Controller from the Helm chart
    const stack = cdk.Stack.of(this);
    const lbHelmValues = {} as HelmValues;
    lbHelmValues.clusterName = cluster.clusterName;
    lbHelmValues.region = stack.region;
    lbHelmValues.vpcId = cluster.vpc.vpcId;
    lbHelmValues.serviceAccount = {
      create: false,
      name: 'aws-load-balancer-controller'
    };
    cluster.addHelmChart('aws-load-balancer-controller', {
      chart: 'aws-load-balancer-controller',
      repository: 'https://aws.github.io/eks-charts',
      namespace: 'kube-system',
      values: lbHelmValues
    });


    const awsauth = new eks.AwsAuth(this, 'EKS_AWSAUTH', {
      cluster: cluster,
    });

    awsauth.node.addDependency()

    awsauth.addMastersRole(props.teamRole)
    awsauth.addUserMapping(props.user, { groups: [ 'system:masters' ]})

    // creating owner namespace
    cluster.addManifest( `${envIdentifier}-team-namespace`, {
      apiVersion: 'v1',
      kind: 'Namespace',
      metadata: { name: props.namespacesNames },
    });



    const permissions = [
      {
        apiGroups: ['*'],
        resources: [
          'pods',
          'pods/logs',
          'events',
          'nodes',
          'configmaps',
          'services',
          'deployments',
          'replicasets',
          'horizontalpodautoscalers',
          'ingresses',
          'statefulsets',
          'limitranges',
          'daemonsets',
        ],
        verbs: ['get', 'list', 'watch'],
      },
      {
        apiGroups: ['batch'],
        resources: ['jobs', 'cronjobs'],
        verbs: ['get', 'list', 'watch'],
      },
      {
        apiGroups: ['metrics.k8s.io'],
        resources: ['pods'],
        verbs: ['get', 'list'],
      },
    ];
    // create a cluster role for backstage
    cluster.addManifest( `backstage-cluster-role`, {
      apiVersion: 'rbac.authorization.k8s.io/v1',
      kind: 'ClusterRole',
      metadata: {name: "backstage-cluster-role"},
      rules: permissions.map((permission) => ({
        apiGroups: permission.apiGroups,
        resources: permission.resources,
        verbs: permission.verbs,
        })
      )
    })

    // creating observability namespace
    cluster.addManifest( `${envIdentifier}-aws-observability-namespace`, {
      apiVersion: 'v1',
      kind: 'Namespace',
      metadata: { name: "aws-observability" },
    });

    // Define the ConfigMap manifest
    const configMapManifest = {
      apiVersion: 'v1',
      kind: 'ConfigMap',
      metadata: {
        name: 'aws-logging',
        namespace: 'aws-observability',
      },
      data: {
        flb_log_cw: 'false',
        filters_conf: `[FILTER]\n    Name parser\n    Match *\n    Key_name log\n    Parser crio\n[FILTER]\n    Name kubernetes\n    Match kube.*\n    Merge_Log On\n    Keep_Log Off\n    Buffer_Size 0\n    Kube_Meta_Cache_TTL 300s`,
        output_conf: `[OUTPUT]\n    Name cloudwatch_logs\n    Match kube.*\n    region region-code\n    log_group_name my-logs\n    log_stream_prefix from-fluent-bit-\n    log_retention_days 60\n    auto_create_group true`,
        parsers_conf: `[PARSER]\n    Name crio\n    Format Regex\n    Regex ^(?<time>[^ ]+) (?<stream>stdout|stderr) (?<logtag>P|F) (?<log>.*)$\n    Time_Key    time\n    Time_Format %Y-%m-%dT%H:%M:%S.%L%z`,
      },
    };


    // Add the ConfigMap manifest to the cluster
    cluster.addManifest('ConfigMapManifest', configMapManifest);



    const clusterParam = new ssm.StringParameter(this, `${name}-eks-cluster-param`, {
      allowedPattern: ".*",
      description: `The EKS Cluster for AAD Solution: ${props.aadEnv.envName} Environment`,
      parameterName: `${envPathIdentifier}/eks-cluster`,
      stringValue: cluster.clusterArn
    });
    
    this.clusterParameter = clusterParam
    this.cluster = cluster


  }
}
