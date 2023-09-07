// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

import {
  CreateStackCommandOutput,
  DeleteStackCommandOutput,
  DescribeStackEventsCommandOutput,
  Stack,
  UpdateStackCommandOutput
} from "@aws-sdk/client-cloudformation";
import { LogStream } from '@aws-sdk/client-cloudwatch-logs';
import { ScanCommandOutput } from '@aws-sdk/client-dynamodb';
import { Service, Task, TaskDefinition } from '@aws-sdk/client-ecs';
import { HeadObjectCommandOutput } from '@aws-sdk/client-s3';
import { DeleteSecretCommandOutput, GetSecretValueCommandOutput } from '@aws-sdk/client-secrets-manager';
import { GetParameterCommandOutput } from '@aws-sdk/client-ssm';
import { AWSProviderParams, AWSServiceResources, BackendParams, BindResourceParams } from '@aws/plugin-aws-apps-common-for-backstage';
import { createApiRef } from '@backstage/core-plugin-api';
import { ContainerDetailsType } from '../types';

export const bawsApiRef = createApiRef<AADApi>({
  id: 'plugin.baws.app',
});

export interface AADApi {
  setBackendParams(backendParams: BackendParams):void;

  getAuditDetails(): Promise<ScanCommandOutput>;

  getTaskDetails({
    service,
    cluster,
  }: {
    service: string;
    cluster: string;
  }): Promise<Task>;

  updateService({
    cluster,
    service,
    taskDefinition,
    restart,
    desiredCount,
  }: {
    cluster: string;
    service: string;
    taskDefinition: string;
    desiredCount: number | undefined;
    restart: boolean;
  }): Promise<Service>;

  getSecret({
    secretName,
  }: {
    secretName: string;
  }): Promise<GetSecretValueCommandOutput>;

  getPlatformSecret({
    secretName,
  }: {
    secretName: string;
  }): Promise<GetSecretValueCommandOutput>;

  getPlatformSSMParam({
    paramName,
  }: {
    paramName: string;
  }): Promise<GetParameterCommandOutput>;

  bindResource({
    params,
    gitAdminSecret
  }:{
    params:BindResourceParams;
    gitAdminSecret: string;
  }) : Promise<any>;

  unBindResource({
    params,
    gitAdminSecret
  }:{
    params:BindResourceParams;
    gitAdminSecret: string;
  }) : Promise<any>;

  deleteProvider({
    stackName,
    accessRole
  }: {
    stackName:string;
    accessRole:string;
  }):Promise<DeleteStackCommandOutput>;

  deletePlatformSecret({
    secretName
  }: {
    secretName:string;
  }):Promise<DeleteSecretCommandOutput>;

  deleteRepository({
    gitHost,
    gitProject,
    gitRepoName,
    gitAdminSecret
  }: {
    gitHost:string;
    gitProject:string;
    gitRepoName:string;
    gitAdminSecret:string;
  }):Promise<any>;

  getResourceGroupResources({
    rscGroupArn,
  }: {
    rscGroupArn: string;
  }): Promise<AWSServiceResources>;

  getSSMParameter({
    ssmParamName,
  }: {
    ssmParamName: string;
  }): Promise<GetParameterCommandOutput>;

  getLogStreamNames({
    logGroupName,
  }: {
    logGroupName: string;
  }): Promise<LogStream[]>;

  getLogStreamData({
    logGroupName,
  }: {
    logGroupName: string;
    logStreamName: string;
  }): Promise<string>;

  getStackDetails({
    stackName,
  }: {
    stackName: string;
  }): Promise<Stack>;

  getStackEvents({
    stackName,
  }: {
    stackName: string;
  }): Promise<DescribeStackEventsCommandOutput>;

  updateStack({
    componentName,
    stackName,
    s3BucketName,
    cfFileName,
    environmentName,
    gitHost,
    gitProjectGroup,
    gitRepoName,
    gitAdminSecret,
  }: {
    componentName: string;
    stackName: string;
    s3BucketName: string;
    cfFileName: string;
    environmentName?: string;
    gitHost?: string;
    gitProjectGroup?: string;
    gitRepoName?: string;
    gitAdminSecret?: string;
  }): Promise<UpdateStackCommandOutput>;

  createStack({
    componentName,
    stackName,
    s3BucketName,
    cfFileName,
    environmentName,
    gitHost,
    gitProjectGroup,
    gitRepoName,
    gitAdminSecret,
  }: {
    componentName: string;
    stackName: string;
    s3BucketName: string;
    cfFileName: string;
    environmentName?: string;
    gitHost?: string;
    gitProjectGroup?: string;
    gitRepoName?: string;
    gitAdminSecret?: string;
  }): Promise<CreateStackCommandOutput>;

  deleteStack({
    componentName,
    stackName,
  }: {
    componentName: string;
    stackName: string;
  }): Promise<DeleteStackCommandOutput>;

  doesS3FileExist({
    bucketName,
    fileName,
  }: {
    bucketName: string;
    fileName: string;
  }): Promise<HeadObjectCommandOutput>;

  updateTaskDefinition({
    taskDefinitionArn,
    envVar
  }: {
    taskDefinitionArn: string;
    envVar: ContainerDetailsType[];
  }): Promise<TaskDefinition>;

  describeTaskDefinition({
    taskDefinitionArn,
  }: {
    taskDefinitionArn: string;
  }): Promise<TaskDefinition>;

  promoteApp({
    envName,
    envRequiresManualApproval,
    gitHost,
    gitJobID,
    gitProjectGroup,
    gitRepoName,
    gitAdminSecret,
    providersData
  }: {
    envName: string;
    envRequiresManualApproval: boolean;
    gitHost: string;
    gitJobID: string;
    gitProjectGroup: string;
    gitRepoName: string;
    gitAdminSecret: string;
    providersData: AWSProviderParams[];
  }): Promise<any>;

  scaleEKSDeployment({
    deploymentName,
    namespace,
    replicaCount,
  }: {
    deploymentName: string;
    namespace: string,
    replicaCount: number
  }): Promise<any>;

}
