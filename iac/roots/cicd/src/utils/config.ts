// Copyright 2023 Amazon.com and its affiliates; all rights reserved.
// This file is Amazon Web Services Content and may not be duplicated or distributed without permission.
// SPDX-License-Identifier: MIT-0

export interface CicdConfig {
    readonly appName: string;
    readonly envName: string;
    readonly awsAccountId: string;
    readonly awsDefaultRegion: string;
    readonly enableOncePerAccountResources: boolean;
    readonly gitLabGroup: string;
    readonly gitLabProject: string;
}

export async function getConfig(): Promise<CicdConfig> {
    const config: CicdConfig = {
        appName: process.env.APP_NAME as string,
        envName: process.env.ENV_NAME as string,
        awsAccountId: process.env.AWS_ACCOUNT_ID as string,
        awsDefaultRegion: process.env.AWS_DEFAULT_REGION as string,
        enableOncePerAccountResources: "true" === process.env.ENABLE_ONCE_PER_ACCOUNT_RESOURCES ? true : false,
        gitLabGroup: process.env.gitProjectGroup as string,
        gitLabProject: process.env.gitProjectName as string,
    };
    return config;
}
