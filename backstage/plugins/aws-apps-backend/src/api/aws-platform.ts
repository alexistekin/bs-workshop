import { CloudFormationClient, DeleteStackCommand, DeleteStackCommandOutput } from "@aws-sdk/client-cloudformation";
import { DeleteSecretCommand, DeleteSecretCommandInput, DeleteSecretCommandOutput, GetSecretValueCommand, GetSecretValueCommandInput, GetSecretValueCommandOutput, SecretsManagerClient } from "@aws-sdk/client-secrets-manager";
import {
  SSMClient,
  GetParameterCommand,
  GetParameterCommandInput,
  GetParameterCommandOutput,
} from '@aws-sdk/client-ssm';

import { AssumeRoleCommand, STSClient } from '@aws-sdk/client-sts';
import { AppPromoParams, BindResourceParams, GitRepoParams } from "@aws/plugin-aws-apps-common-for-backstage";
import { Logger } from "winston";

export type GitLabDownloadFileResponse = {
  file_name: string;
  file_path: string;
  size: number;
  encoding: string;
  content: string;
  content_sha256: string;
  ref: string;
  blob_id: string;
  commit_id: string;
  last_commit_id: string;
  execute_filemode: boolean;
}

export class AwsAppsPlatformApi {

  public constructor(
    private readonly logger: Logger,
    private readonly awsRegion: string,
    private readonly awsAccount: string,
  ) {
    this.logger.info('Instantiating AWS Apps Platform API with:');
    this.logger.info(`awsAccount: ${this.awsAccount}`);
    this.logger.info(`awsRegion: ${this.awsRegion}`);
  }

  /**
    * Get SecretsManager Secret value.
    *
    * @remarks
    * Get SecretsManager Secret value.
    *
    * @param secretArn - The Arn or name of the secret to retrieve
    * @returns The GetSecretValueCommandOutput object
    *
    */
  public async getPlatformSecretValue(secretArn: string): Promise<GetSecretValueCommandOutput> {
    this.logger.info('Calling getPlatformSecretValue');

    const client = new SecretsManagerClient({
      region: this.awsRegion
    });
    const params: GetSecretValueCommandInput = {
      SecretId: secretArn,
    };
    const command = new GetSecretValueCommand(params);
    const resp = client.send(command);
    return resp;
  }

  /**
    * Get SSM Parameter Store value.
    *
    * @remarks
    * Get SSM Parameter Store value.
    *
    * @param ssmKey - The SSM param key to retrieve
    * @returns The GetParameterCommandOutput object
    *
    */
  public async getSsmValue(ssmKey: string): Promise<GetParameterCommandOutput> {
    this.logger.info('Calling getSsmValue');
    const client = new SSMClient({
      region: this.awsRegion
    });

    const params: GetParameterCommandInput = {
      Name: ssmKey,
      WithDecryption: true,
    };
    const command = new GetParameterCommand(params);
    const resp = client.send(command);
    return resp;
  }

  public async deletePlatformSecret(secretName: string): Promise<DeleteSecretCommandOutput> {
    this.logger.info('Calling deletePlatformSecret');
    const client = new SecretsManagerClient({
      region: this.awsRegion
    });

    const params: DeleteSecretCommandInput = {
      SecretId: secretName,
      ForceDeleteWithoutRecovery: true,
    };
    const command = new DeleteSecretCommand(params);
    const resp = client.send(command);
    return resp;
  }


  public async deleteCFStack(stackName: string, accessRole: string): Promise<DeleteStackCommandOutput> {
    this.logger.info('Calling deleteProvider');
    const stsClient = new STSClient({ region: this.awsRegion });
    //console.log(`deleting ${stackName}`)
    const stsResult = await stsClient.send(
      new AssumeRoleCommand({
        RoleArn: accessRole,
        RoleSessionName: `backstage-session`,
        DurationSeconds: 3600, // max is 1 hour for chained assumed roles
      }),
    );
    if (stsResult.Credentials) {
      //console.log(stsResult.Credentials)
      const client = new CloudFormationClient({
        region: this.awsRegion,
        credentials: {
          accessKeyId: stsResult.Credentials.AccessKeyId!,
          secretAccessKey: stsResult.Credentials.SecretAccessKey!,
          sessionToken: stsResult.Credentials.SessionToken,
        },
      });

      const input = {
        StackName: stackName,
      };
      const command = new DeleteStackCommand(input);
      const response = client.send(command);
      return response
    }
    else {
      throw new Error("can't fetch credentials to remove requested provider")
    }
  }

  public async deleteRepository(gitHost: string, gitProjectGroup: string, gitRepoName: string, gitSecretName: string): Promise<{ status: string, message?: string }> {
    const gitAdminSecret = await this.getPlatformSecretValue(gitSecretName);
    const gitAdminSecretObj = JSON.parse(gitAdminSecret.SecretString || "");
    const gitToken = gitAdminSecretObj["apiToken"];
    // fetch project ID
    const gitProjects = await fetch(`https://${gitHost}/api/v4/projects?search=${gitRepoName}`,
      {
        method: 'GET', headers: {
          'PRIVATE-TOKEN': gitToken,
          'Content-Type': 'application/json',
        }
      });
    const gitProjectsJson: { path_with_namespace: string, id: string }[] = await gitProjects.json();
    let project = null;
    if (gitProjectsJson) {
      project = gitProjectsJson.filter(project => project.path_with_namespace === `${gitProjectGroup}/${gitRepoName}`)[0];
    }
    if (project && project.id) {
      console.log(`Got GitLab project ID: ${gitProjectsJson[0]?.id}`);

      // now delete the repo
      const url = `https://${gitHost}/api/v4/projects/${gitProjectGroup}%2F${gitRepoName}`
      console.log(url)
      const deleteRepoResults = await fetch(url, {
        method: 'DELETE',
        headers: {
          'PRIVATE-TOKEN': gitToken
        }
      });
      console.log(deleteRepoResults)
      if (deleteRepoResults.status > 299) {
        return { status: "FAILURE", message: `Repository failed to delete` };
      }
      else {
        return { status: "SUCCESS", message: `Repository deleted successfully` };
      }
    }
    else {
      console.error(`ERROR: Failed to retrieve project ID for ${gitRepoName}`);
      return { status: "FAILURE", message: `Failed to retrieve Git project ID for ${gitRepoName}` };
    }
  }

  private async getGitToken(gitSecretName: string): Promise<string> {
    const gitAdminSecret = await this.getPlatformSecretValue(gitSecretName);
    const gitAdminSecretObj = JSON.parse(gitAdminSecret.SecretString || "");
    return gitAdminSecretObj["apiToken"];
  }

  private async getGitProjectId(gitHost: string, gitProjectGroup: string, gitRepoName: string, gitToken: string): Promise<string> {
    const gitProjects = await fetch(`https://${gitHost}/api/v4/projects?search=${gitRepoName}`,
      {
        method: 'GET', headers: {
          'PRIVATE-TOKEN': gitToken,
          'Content-Type': 'application/json',
        }
      });

    const gitProjectsJson: { path_with_namespace: string, id: string }[] = await gitProjects.json();
    let project = null;
    if (gitProjectsJson) {
      project = gitProjectsJson.filter(project => project.path_with_namespace === `${gitProjectGroup}/${gitRepoName}`)[0];
    }

    if (project && project.id) {
      return project.id;
    } else {
      throw new Error(`Failed to get git project ID for group '${gitProjectGroup}' and repo '${gitRepoName}'`);
    }

  }

  public async getFileContentsFromGit(repo: GitRepoParams, filePath: string, gitSecretName: string): Promise<GitLabDownloadFileResponse> {
    const gitToken = await this.getGitToken(gitSecretName);

    let gitProjectId: string;
    gitProjectId = await this.getGitProjectId(repo.gitHost, repo.gitProjectGroup, repo.gitRepoName, gitToken);
    console.log(`Got GitLab project ID: ${gitProjectId}`);

    const url = `https://${repo.gitHost}/api/v4/projects/${gitProjectId}/repository/files/${filePath}?ref=main`;
    const result = await fetch(new URL(url), {
      method: 'GET',
      headers: {
        'PRIVATE-TOKEN': gitToken,
        'Content-Type': 'application/json',
      },
    });

    const resultBody = await result.json();
    if (result.status > 299) {
      console.error(`ERROR: Failed to retrieve ${filePath} for ${repo.gitRepoName}. Response code: ${result.status} - ${resultBody}`);
      throw new Error(`Failed to retrieve ${filePath} for ${repo.gitRepoName}. Response code: ${result.status}`);
    } else {
      return resultBody;
    }

  }

  public async promoteAppToGit(input: AppPromoParams, gitSecretName: string): Promise<{ status: string, message?: string }> {
    const gitToken = await this.getGitToken(gitSecretName);

    // Hardcoded responses for developer testing
    // return {status: "SUCCESS", message: `Promotion will not be complete until deployment succeeds. Check the CICD pipeline for the most up-to-date information. UI status may take a few minutes to update.`};
    // return {status: "FAILURE", message: "Some error description"};

    let gitProjectId: string;
    try {
      gitProjectId = await this.getGitProjectId(input.gitHost, input.gitProjectGroup, input.gitRepoName, gitToken);
      console.log(`Got GitLab project ID: ${gitProjectId}`);
    } catch (err: any) {
      console.error(`ERROR: ${err.toString()}`);
      return { status: "FAILURE", message: `Failed to retrieve Git project ID for ${input.gitRepoName}` };
    }

    //Now build a new commit that will trigger the pipeline
    const actions = await Promise.all(input.providers.map(async (provider) => {
      const propsFile = `.awsdeployment/providers/${input.envName}-${provider.providerName}.properties`;
      const prov1EnvRoleArn = (await this.getSsmValue(provider.assumedRoleArn)).Parameter?.Value;
      let propsContent =
        `ACCOUNT=${provider.awsAccount}\nREGION=${provider.awsRegion}\nENV_NAME=${provider.environmentName}\nPREFIX=${provider.prefix}\n` +
        `ENV_PROVIDER_NAME=${provider.providerName}\nENV_ROLE_ARN=${prov1EnvRoleArn}\nAAD_CI_ENVIRONMENT=${provider.environmentName}-${provider.providerName}\n` +
        `AAD_CI_ENVIRONMENT_MANUAL_APPROVAL=${input.envRequiresManualApproval}\n` +
        `AAD_CI_REGISTRY_IMAGE=${provider.awsAccount}.dkr.ecr.${provider.awsRegion}.amazonaws.com/${input.appName}-${provider.providerName}\n`;

      Object.keys(provider.parameters).forEach(key => {
        propsContent += `${key}=${provider.parameters[key]}\n`
      });

      return {
        action: "create",
        file_path: propsFile,
        content: propsContent
      };

    }));

    const commit = {
      branch: "main",
      commit_message: "generate CICD stages",
      actions: actions
    }

    const url = `https://${input.gitHost}/api/v4/projects/${gitProjectId}/repository/commits`;
    const result = await fetch(new URL(url), {
      method: 'POST',
      body: JSON.stringify(commit),
      headers: {
        'PRIVATE-TOKEN': gitToken,
        'Content-Type': 'application/json',
      },
    });

    const resultBody = await result.json();
    if (result.status > 299) {
      console.error(`ERROR: Failed to promote ${input.envName}. Response code: ${result.status} - ${resultBody}`);
      let message = "";
      if (resultBody.message?.includes('A file with this name already exists')) {
        message = `${input.envName} has already been scheduled for promotion. Check the CICD pipeline for the most up-to-date information. UI status may take a few minutes to update.`;
      } else {
        message = resultBody.message || '';
      }
      return { status: "FAILURE", message };
    } else {
      return { status: "SUCCESS", message: `Promotion will not be complete until deployment succeeds. Check the CICD pipeline for the most up-to-date information. UI status may take a few minutes to update.` };
    }

  }

  public async bindResource(input: BindResourceParams, gitSecretName: string): Promise<{ status: string, message?: string }> {
    const gitAdminSecret = await this.getPlatformSecretValue(gitSecretName);
    const gitAdminSecretObj = JSON.parse(gitAdminSecret.SecretString || "");
    const gitToken = gitAdminSecretObj["apiToken"];

    // fetch project ID
    const gitProjects = await fetch(`https://${input.gitHost}/api/v4/projects?search=${input.gitRepoName}`,
      {
        method: 'GET', headers: {
          'PRIVATE-TOKEN': gitToken,
          'Content-Type': 'application/json',
        }
      });

    const gitProjectsJson: { path_with_namespace: string, id: string }[] = await gitProjects.json();
    let project = null;
    if (gitProjectsJson) {
      project = gitProjectsJson.filter(project => project.path_with_namespace === `${input.gitProjectGroup}/${input.gitRepoName}`)[0];
    }

    if (project && project.id) {
      console.log(`Got GitLab project ID: ${gitProjectsJson[0]?.id}`);

      const actions = input.policies.map(p => {
        const policyFile = `.iac/aws_ecs/permissions/${input.envName}/${input.providerName}/${p.policyFileName}.json`;
        const policyContent = p.policyContent;

        return {
          action: "create",
          file_path: policyFile,
          content: policyContent
        };
      })

      const resourceBindContent = `RESOURCE_ENTITY_REF=${input.resourceEntityRef}\nRESOURCE_ENTITY=${input.resourceName}\nTARGET_ENV_NAME=${input.envName}\nTARGET_ENV_PROVIDER_NAME=${input.providerName}`
      const resourceBindFile = `.awsdeployment/resource-binding-params-temp.properties`;
      actions.push({
        action: "create",
        file_path: resourceBindFile,
        content: resourceBindContent
      })

      const commit = {
        branch: "main",
        commit_message: `Bind Resource`,
        actions: actions
      }

      const url = `https://${input.gitHost}/api/v4/projects/${gitProjectsJson[0].id}/repository/commits`;
      const result = await fetch(new URL(url), {
        method: 'POST',
        body: JSON.stringify(commit),
        headers: {
          'PRIVATE-TOKEN': gitToken,
          'Content-Type': 'application/json',
        },
      });

      const resultBody = await result.json();
      if (result.status > 299) {
        console.error(`ERROR: Failed to bind ${input.envName}. Response code: ${result.status} - ${resultBody}`);
        let message = "";
        if (resultBody.message?.includes('A file with this name already exists')) {
          message = `${input.envName} has already been scheduled for binding. Check the CICD pipeline for the most up-to-date information. UI status may take a few minutes to update.`;
        } else {
          message = resultBody.message || '';
        }
        return { status: "FAILURE", message };
      } else {
        return { status: "SUCCESS", message: `Binding will not be complete until deployment succeeds. Check the CICD pipeline for the most up-to-date information. UI status may take a few minutes to update.` };
      }

    } else {
      console.error(`ERROR: Failed to retrieve project ID for ${input.gitRepoName}`);
      return { status: "FAILURE", message: `Failed to retrieve Git project ID for ${input.gitRepoName}` };
    }

  }

  public async unBindResource(input: BindResourceParams, gitSecretName: string): Promise<{ status: string, message?: string }> {
    const gitAdminSecret = await this.getPlatformSecretValue(gitSecretName);
    const gitAdminSecretObj = JSON.parse(gitAdminSecret.SecretString || "");
    const gitToken = gitAdminSecretObj["apiToken"];

    // fetch project ID
    const gitProjects = await fetch(`https://${input.gitHost}/api/v4/projects?search=${input.gitRepoName}`,
      {
        method: 'GET', headers: {
          'PRIVATE-TOKEN': gitToken,
          'Content-Type': 'application/json',
        }
      });

    const gitProjectsJson: { path_with_namespace: string, id: string }[] = await gitProjects.json();
    let project = null;
    if (gitProjectsJson) {
      project = gitProjectsJson.filter(project => project.path_with_namespace === `${input.gitProjectGroup}/${input.gitRepoName}`)[0];
    }

    if (project && project.id) {
      console.log(`Got GitLab project ID: ${gitProjectsJson[0]?.id}`);

      const actions = input.policies.map(p => {
        const policyFile = `.iac/aws_ecs/permissions/${input.envName}/${input.providerName}/${p.policyFileName}.json`;
        const policyContent = p.policyContent;

        return {
          action: "delete",
          file_path: policyFile,
          content: policyContent
        };
      })

      const resourceBindContent = `RESOURCE_ENTITY_REF=${input.resourceEntityRef}\nRESOURCE_ENTITY=${input.resourceName}\nTARGET_ENV_NAME=${input.envName}\nTARGET_ENV_PROVIDER_NAME=${input.providerName}`
      const resourceBindFile = `.awsdeployment/resource-binding-params-temp.properties`;
      actions.push({
        action: "create",
        file_path: resourceBindFile,
        content: resourceBindContent
      })

      const commit = {
        branch: "main",
        commit_message: `UnBind Resource`,
        actions: actions
      }

      const url = `https://${input.gitHost}/api/v4/projects/${gitProjectsJson[0].id}/repository/commits`;
      const result = await fetch(new URL(url), {
        method: 'POST',
        body: JSON.stringify(commit),
        headers: {
          'PRIVATE-TOKEN': gitToken,
          'Content-Type': 'application/json',
        },
      });

      const resultBody = await result.json();
      if (result.status > 299) {
        console.error(`ERROR: Failed to unbind ${input.envName}. Response code: ${result.status} - ${resultBody}`);
        let message = "";
        if (resultBody.message?.includes('A file with this name already exists')) {
          message = `${input.envName} has already been scheduled for unbinding. Check the CICD pipeline for the most up-to-date information. UI status may take a few minutes to update.`;
        } else {
          message = resultBody.message || '';
        }
        return { status: "FAILURE", message };
      } else {
        return { status: "SUCCESS", message: `UnBinding will not be complete until deployment succeeds. Check the CICD pipeline for the most up-to-date information. UI status may take a few minutes to update.` };
      }

    } else {
      console.error(`ERROR: Failed to retrieve project ID for ${input.gitRepoName}`);
      return { status: "FAILURE", message: `Failed to retrieve Git project ID for ${input.gitRepoName}` };
    }

  }
}
