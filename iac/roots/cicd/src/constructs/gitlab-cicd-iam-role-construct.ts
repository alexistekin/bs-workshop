/**
 * Copyright 2023 Amazon.com, Inc. and its affiliates. All Rights Reserved.
 *
 * Licensed under the Amazon Software License (the "License").
 * You may not use this file except in compliance with the License.
 * A copy of the License is located at
 *
 *   http://aws.amazon.com/asl/
 *
 * or in the "license" file accompanying this file. This file is distributed
 * on an "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either
 * express or implied. See the License for the specific language governing
 * permissions and limitations under the License.
 */
import * as cdk from "aws-cdk-lib";
import { Construct } from "constructs";
import * as iam from 'aws-cdk-lib/aws-iam';

import { CicdConfig } from "../utils/config";

/* eslint-disable @typescript-eslint/no-empty-interface */
export interface GitLabIamRoleConstructProps extends cdk.StackProps {
    /**
    * Application config
    */
    readonly config: CicdConfig;

    /**
     * The ARN of the role that can assume the CICD role
     */
    readonly assumeRoleArn: string;
}

const defaultProps: Partial<GitLabIamRoleConstructProps> = {};

/**
 * Deploys the IAM role for GitLab CICD pipeline to assume
 */
export class GitLabIamRoleConstruct extends Construct {

    constructor(parent: Construct, name: string, props: GitLabIamRoleConstructProps) {
        super(parent, name);

        /* eslint-disable @typescript-eslint/no-unused-vars */
        props = { ...defaultProps, ...props };

        const gitLabInlinePolicy = new iam.PolicyDocument({
            statements: [
                new iam.PolicyStatement({
                    actions: [
                        "sts:AssumeRole",
                        "sts:TagSession",
                        "iam:PassRole",
                    ],
                    resources: [
                        `arn:aws:iam::${props.config.awsAccountId}:role/cdk-*`
                    ],
                }),
                new iam.PolicyStatement({
                    actions: [
                        "ssm:*",
                    ],
                    resources: [
                        `arn:aws:ssm:*:${props.config.awsAccountId}:parameter/${props.config.appName}-*`
                    ],
                }),
            ],
        });

        new iam.SessionTagsPrincipal(
            new iam.ArnPrincipal(props.assumeRoleArn)
        ).withConditions({
            StringEquals: {
                'aws:PrincipalTag/GitLab:Group': props.config.gitLabGroup,
                "aws:PrincipalTag/GitLab:Project": props.config.gitLabProject,
            },
        },);

        new iam.Role(this, `${props.config.appName}-${props.config.envName}-cicd-role`, {
            roleName: `${props.config.appName}-${props.config.envName}-cicd-role`,
            assumedBy: new iam.PrincipalWithConditions(
                new iam.ArnPrincipal(
                    props.assumeRoleArn,
                ),
                {
                    StringEquals: {
                        'aws:PrincipalTag/GitLab:Group': props.config.gitLabGroup,
                        "aws:PrincipalTag/GitLab:Project": props.config.gitLabProject,
                    },
                },
            ).withSessionTags(),
            description: `CICD role for use by the ${props.config.appName} project`,
            inlinePolicies: {
                [`${props.config.appName}-${props.config.envName}-gitlab-policy`]: gitLabInlinePolicy,
            },
            managedPolicies: [
                iam.ManagedPolicy.fromAwsManagedPolicyName(
                    'PowerUserAccess',
                ),
            ],
        });

    }
}
