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
import { ConfigApi, FetchApi } from '@backstage/core-plugin-api';
import { ResponseError } from '@backstage/errors';
import { AADApi } from '.';
import { HTTP } from '../helpers/constants';
import { ContainerDetailsType } from '../types';


export class AADApiClient implements AADApi {
  private readonly configApi: ConfigApi;
  private readonly fetchApi: FetchApi;
  private backendParams: BackendParams;

  public constructor(options: { configApi: ConfigApi; fetchApi: FetchApi; }) {
    this.configApi = options.configApi;
    this.fetchApi = options.fetchApi;
    this.backendParams = { appName: '', awsAccount: '', awsRegion: '', prefix: '', providerName: '' };
  }

  public setBackendParams(backendParams: BackendParams) {
    this.backendParams = backendParams;
  }

  async getTaskDetails({
    cluster,
    service,
  }: {
    cluster: string;
    service: string;
  }): Promise<Task> {

    const postBody = {
      awsRegion: this.backendParams.awsRegion,
      awsAccount: this.backendParams.awsAccount,
      serviceName: service,
      clusterName: cluster,
      prefix: this.backendParams.prefix,
      providerName: this.backendParams.providerName,
      appName: this.backendParams.appName
    }

    const task = this.fetch<Task>('/ecs', HTTP.POST, postBody);

    return task;
  }

  async getAuditDetails(): Promise<ScanCommandOutput> {
    const body = {
      awsRegion: this.backendParams.awsRegion,
      awsAccount: this.backendParams.awsAccount,
      appName: this.backendParams.appName,
      prefix: this.backendParams.prefix,
      providerName: this.backendParams.providerName
    };

    const path = `/dynamo-db/query`;
    const results = this.fetch<ScanCommandOutput>(path, HTTP.POST, body);
    return results;
  }

  async updateService({
    cluster,
    service,
    taskDefinition,
    desiredCount,
    restart,
  }: {
    cluster: string;
    service: string;
    taskDefinition: string;
    desiredCount: number | undefined;
    restart: boolean;
  }): Promise<Service> {

    const postBody = {
      awsRegion: this.backendParams.awsRegion,
      awsAccount: this.backendParams.awsAccount,
      appName: this.backendParams.appName,
      prefix: this.backendParams.prefix,
      providerName: this.backendParams.providerName,
      clusterName: cluster,
      serviceName: service,
      taskDefinition: taskDefinition,
      restart: restart,
      desiredCount: desiredCount,
    }

    const serviceDetails = this.fetch<Service>('/ecs/updateService', HTTP.POST, postBody);

    return serviceDetails;
  }

  async getSecret({
    secretName,
  }: {
    secretName: string;
  }): Promise<GetSecretValueCommandOutput> {

    const postBody = {
      awsRegion: this.backendParams.awsRegion,
      awsAccount: this.backendParams.awsAccount,
      appName: this.backendParams.appName,
      prefix: this.backendParams.prefix,
      providerName: this.backendParams.providerName,
      secretArn: secretName,
    }
    const secretDetails = this.fetch<GetSecretValueCommandOutput>('/secrets', HTTP.POST, postBody);

    return secretDetails;
  }

  async getLogStreamNames({
    logGroupName,
  }: {
    logGroupName: string;
  }): Promise<LogStream[]> {

    const path = '/logs/stream';

    const logStreams = this.fetch<LogStream[]>(path, HTTP.POST, {
      logGroupName,
      awsRegion: this.backendParams.awsRegion,
      awsAccount: this.backendParams.awsAccount,
      appName: this.backendParams.appName,
      prefix: this.backendParams.prefix,
      providerName: this.backendParams.providerName,
    });

    return logStreams;
  }

  async getLogStreamData({
    logGroupName,
    logStreamName,
  }: {
    logGroupName: string;
    logStreamName: string;
  }): Promise<string> {

    const path = '/logs/stream-events';

    const logStreamData = this.fetch<string>(path, HTTP.POST, {
      logGroupName,
      logStreamName,
      awsRegion: this.backendParams.awsRegion,
      awsAccount: this.backendParams.awsAccount,
      appName: this.backendParams.appName,
      prefix: this.backendParams.prefix,
      providerName: this.backendParams.providerName,
    });

    return logStreamData;
  }

  //TODO: Move platform calls to separate backend endpoints - interface does not require provider information
  async getPlatformSecret({
    secretName,
  }: {
    secretName: string;
  }): Promise<GetSecretValueCommandOutput> {

    const postBody = {
      awsRegion: this.backendParams.awsRegion,
      awsAccount: this.backendParams.awsAccount,
      appName: this.backendParams.appName,
      prefix: this.backendParams.prefix,
      providerName: this.backendParams.providerName,
      secretArn: secretName
    }

    const secretDetails = this.fetch<GetSecretValueCommandOutput>('/platform/secrets', HTTP.POST, postBody);

    return secretDetails;
  }

  async getPlatformSSMParam({
    paramName,
  }: {
    paramName: string;
  }): Promise<GetParameterCommandOutput> {
    const postBody = {
      awsRegion: this.backendParams.awsRegion,
      awsAccount: this.backendParams.awsAccount,
      appName: this.backendParams.appName,
      prefix: this.backendParams.prefix,
      providerName: this.backendParams.providerName,
      paramName
    }

    const paramDetails = this.fetch<GetParameterCommandOutput>('/platform/ssm', HTTP.POST, postBody);

    return paramDetails;
  }
  
  async bindResource({
    params,
    gitAdminSecret
  }:{
    params:BindResourceParams;
    gitAdminSecret: string;
  }) : Promise<any>
  {
    const postBody = {
      awsRegion: this.backendParams.awsRegion,
      awsAccount: this.backendParams.awsAccount,
      appName: this.backendParams.appName,
      prefix: this.backendParams.prefix,
      providerName: params.providerName,
      gitHost:params.gitHost,
      gitProjectGroup:params.gitProjectGroup,
      gitRepoName:params.gitRepoName,
      gitAdminSecret,
      envName:params.envName,
      policies:params.policies,
      resourceName:params.resourceName,
      resourceEntityRef: params.resourceEntityRef
    }

    const bindResponse = this.fetch<any>('/platform/bind-resource', HTTP.POST, postBody);

    return bindResponse;
  }

  async unBindResource({
    params,
    gitAdminSecret
  }:{
    params:BindResourceParams;
    gitAdminSecret: string;
  }) : Promise<any>
  {
    const postBody = {
      awsRegion: this.backendParams.awsRegion,
      awsAccount: this.backendParams.awsAccount,
      appName: this.backendParams.appName,
      prefix: this.backendParams.prefix,
      providerName: params.providerName,
      gitHost:params.gitHost,
      gitProjectGroup:params.gitProjectGroup,
      gitRepoName:params.gitRepoName,
      gitAdminSecret,
      envName:params.envName,
      policies:params.policies,
      resourceName:params.resourceName,
      resourceEntityRef: params.resourceEntityRef
    }

    const unBindResponse = this.fetch<any>('/platform/unbind-resource', HTTP.POST, postBody);

    return unBindResponse;
  }

  async deleteProvider({
    stackName,
    accessRole
  }: {
    stackName: string;
    accessRole: string;
  }): Promise<DeleteStackCommandOutput> {
    const postBody = {
      awsRegion: this.backendParams.awsRegion,
      awsAccount: this.backendParams.awsAccount,
      appName: this.backendParams.appName,
      prefix: this.backendParams.prefix,
      providerName: this.backendParams.providerName,
      stackName,
      accessRole
    }

    const deleteResponse = this.fetch<DeleteStackCommandOutput>('/platform/delete-stack', HTTP.POST, postBody);

    return deleteResponse;
  }

  async deletePlatformSecret({
    secretName
  }: {
    secretName: string;
  }): Promise<DeleteSecretCommandOutput> {
    const postBody = {
      awsRegion: this.backendParams.awsRegion,
      awsAccount: this.backendParams.awsAccount,
      appName: this.backendParams.appName,
      prefix: this.backendParams.prefix,
      providerName: this.backendParams.providerName,
      secretName
    }

    const deleteResponse = this.fetch<DeleteSecretCommandOutput>('/platform/delete-secret', HTTP.POST, postBody);

    return deleteResponse;

  };

  async deleteRepository({
    gitHost,
    gitProject,
    gitRepoName,
    gitAdminSecret
  }: {
    gitHost: string;
    gitProject: string;
    gitRepoName: string;
    gitAdminSecret: string;
  }): Promise<any> {
    const postBody = {
      awsRegion: this.backendParams.awsRegion,
      awsAccount: this.backendParams.awsAccount,
      appName: this.backendParams.appName,
      prefix: this.backendParams.prefix,
      providerName: this.backendParams.providerName,
      gitHost,
      gitProject,
      gitRepoName,
      gitAdminSecret
    }
    const deleteResponse = this.fetch<any>('/platform/delete-repository', HTTP.POST, postBody);
    return deleteResponse;
  }

  async getStackDetails({
    stackName,
  }: {
    stackName: string;

  }): Promise<Stack> {
    const path = '/cloudformation/describeStack';

    const stack = this.fetch<Stack>(path, HTTP.POST, {
      stackName,
      awsRegion: this.backendParams.awsRegion,
      awsAccount: this.backendParams.awsAccount,
      appName: this.backendParams.appName,
      prefix: this.backendParams.prefix,
      providerName: this.backendParams.providerName,
    });

    return stack;
  }

  async getStackEvents(
    { stackName, }: { stackName: string; })
    : Promise<DescribeStackEventsCommandOutput> {
    const path = '/cloudformation/describeStackEvents';

    const stack = this.fetch<DescribeStackEventsCommandOutput>(path, HTTP.POST, {
      stackName,
      awsRegion: this.backendParams.awsRegion,
      awsAccount: this.backendParams.awsAccount,
      appName: this.backendParams.appName,
      prefix: this.backendParams.prefix,
      providerName: this.backendParams.providerName,
    });

    return stack;
  }

  async updateStack({
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
  }): Promise<UpdateStackCommandOutput> {
    const path = '/cloudformation/updateStack';

    const stack = this.fetch<UpdateStackCommandOutput>(path, HTTP.POST, {
      componentName,
      stackName,
      s3BucketName,
      cfFileName,
      gitHost,
      gitProjectGroup,
      gitRepoName,
      gitAdminSecret,
      awsRegion: this.backendParams.awsRegion,
      awsAccount: this.backendParams.awsAccount,
      appName: this.backendParams.appName,
      prefix: this.backendParams.prefix,
      environmentName,
      providerName: this.backendParams.providerName,
    });

    return stack;
  }

  async createStack({
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
  }): Promise<CreateStackCommandOutput> {
    const path = '/cloudformation/createStack';

    const stack = this.fetch<CreateStackCommandOutput>(path, HTTP.POST, {
      componentName,
      stackName,
      s3BucketName,
      cfFileName,
      gitHost,
      gitProjectGroup,
      gitRepoName,
      gitAdminSecret,
      awsRegion: this.backendParams.awsRegion,
      awsAccount: this.backendParams.awsAccount,
      appName: this.backendParams.appName,
      prefix: this.backendParams.prefix,
      environmentName,
      providerName: this.backendParams.providerName,
    });

    return stack;
  }

  async deleteStack({
    componentName,
    stackName,
  }: {
    componentName: string;
    stackName: string;
  }): Promise<DeleteStackCommandOutput> {
    const path = '/cloudformation/deleteStack';

    const stack = this.fetch<DeleteStackCommandOutput>(path, HTTP.POST, {
      componentName,
      stackName,
      awsRegion: this.backendParams.awsRegion,
      awsAccount: this.backendParams.awsAccount,
      appName: this.backendParams.appName,
      prefix: this.backendParams.prefix,
      providerName: this.backendParams.providerName,
    });

    return stack;
  }

  doesS3FileExist({
    bucketName,
    fileName,
  }: {
    bucketName: string;
    fileName: string;
  }): Promise<HeadObjectCommandOutput> {
    const path = '/s3/doesFileExist';

    const fileExistsOutput = this.fetch<HeadObjectCommandOutput>(path, HTTP.POST, {
      bucketName,
      fileName,
      awsRegion: this.backendParams.awsRegion,
      awsAccount: this.backendParams.awsAccount,
      appName: this.backendParams.appName,
      prefix: this.backendParams.prefix,
      providerName: this.backendParams.providerName,
    });

    return fileExistsOutput;
  }

  async getResourceGroupResources({
    rscGroupArn,

  }: {
    rscGroupArn: string;
  }): Promise<AWSServiceResources> {

    const postBody = {
      awsRegion: this.backendParams.awsRegion,
      awsAccount: this.backendParams.awsAccount,
      appName: this.backendParams.appName,
      prefix: this.backendParams.prefix,
      providerName: this.backendParams.providerName,
      resourceGroupName: rscGroupArn,
    };

    const rscGroupDetails = this.fetch<AWSServiceResources>('/resource-group', HTTP.POST, postBody);
    return rscGroupDetails;
  }

  async getSSMParameter({
    ssmParamName,
  }: {
    ssmParamName: string;

  }): Promise<GetParameterCommandOutput> {

    const postBody = {
      awsRegion: this.backendParams.awsRegion,
      awsAccount: this.backendParams.awsAccount,
      appName: this.backendParams.appName,
      prefix: this.backendParams.prefix,
      providerName: this.backendParams.providerName,
      ssmParamName,
    };

    const ssmParamDetails = this.fetch<GetParameterCommandOutput>('/ssm-parameter', HTTP.POST, postBody);
    return ssmParamDetails;
  }

  async describeTaskDefinition({
    taskDefinitionArn,
  }: {
    taskDefinitionArn: string;
  }): Promise<TaskDefinition> {

    const postBody = {
      awsRegion: this.backendParams.awsRegion,
      awsAccount: this.backendParams.awsAccount,
      appName: this.backendParams.appName,
      prefix: this.backendParams.prefix,
      providerName: this.backendParams.providerName,
      taskDefinition: taskDefinitionArn,
    }
    const taskD = this.fetch<TaskDefinition>('/ecs/describeTaskDefinition', HTTP.POST, postBody);

    return taskD;
  }

  async updateTaskDefinition({
    taskDefinitionArn,
    envVar,
  }: {
    taskDefinitionArn: string;
    envVar: ContainerDetailsType[];
  }): Promise<TaskDefinition> {

    const postBody = {
      awsRegion: this.backendParams.awsRegion,
      awsAccount: this.backendParams.awsAccount,
      appName: this.backendParams.appName,
      prefix: this.backendParams.prefix,
      providerName: this.backendParams.providerName,
      taskDefinition: taskDefinitionArn,
      envVar: envVar
    }

    const taskD = this.fetch<TaskDefinition>('/ecs/updateTaskDefinition', HTTP.POST, postBody);
    return taskD;
  }

  async promoteApp({
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
  }): Promise<any> {
    const postBody = {
      awsRegion: this.backendParams.awsRegion,
      awsAccount: this.backendParams.awsAccount,
      appName: this.backendParams.appName,
      envName,
      envRequiresManualApproval,
      gitHost,
      gitJobID,
      gitProjectGroup,
      gitRepoName,
      gitAdminSecret,
      providers: providersData
    }
    const results = this.fetch<any>('/git/promote', HTTP.POST, postBody);
    return results;
  }


  async scaleEKSDeployment({
    deploymentName,
    namespace,
    replicaCount,
  }: {
    namespace: string;
    deploymentName: string,
    replicaCount: number
  }):Promise<any>{
    const postBody = {
      awsRegion: this.backendParams.awsRegion,
      awsAccount: this.backendParams.awsAccount,
      appName: this.backendParams.appName,
      prefix: this.backendParams.prefix,
      providerName: this.backendParams.providerName,
      namespace: namespace,
      deploymentName: deploymentName,
      replicaCount: replicaCount
    };
  
    try {
      const cluster = await this.fetch<any>('/kubernetes/scaleEKSDeployment', HTTP.POST, postBody);
      return cluster;
    } catch (error) {
      console.error('Error:', error);
    }
  }

  private async fetch<T>(path: string, method = HTTP.GET, data?: any): Promise<T> {
    const baseUrl = `${await this.configApi.getString('backend.baseUrl')}/api/aws-apps-backend`;
    const url = baseUrl + path;

    let headers: { [k: string]: string } = {};

    let requestOptions: RequestInit = {
      method,
      headers,
    };

    if (data) {
      requestOptions.body = JSON.stringify(data);
      headers['Content-Type'] = 'application/json';
    }
    const response = await this.fetchApi.fetch(url, requestOptions);

    if (!response.ok) {
      throw await ResponseError.fromResponse(response);
    }

    let responseType = response.headers.get('Content-Type');

    if (responseType && responseType.indexOf('application/json') >= 0) {
      return response.json() as Promise<T>;
    } else {
      return response.text() as unknown as Promise<T>;
    }
  }
}
