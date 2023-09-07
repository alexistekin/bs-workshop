// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0


import { Task } from '@aws-sdk/client-ecs';
import { InfoCard, EmptyState } from '@backstage/core-components';
import { useApi } from '@backstage/core-plugin-api';
import { LinearProgress } from '@material-ui/core';
import ContentCopyIcon from '@mui/icons-material/ContentCopy';
import { Button, CardContent, Divider, Grid, IconButton, Typography } from '@mui/material';
import React, { useState } from 'react';
import { bawsApiRef } from '../../api';
import { useAsyncAwsApp } from '../../hooks/useAwsApp';
import { AWSComponent, AWSEKSAppDeploymentEnvironment } from '@aws/plugin-aws-apps-common-for-backstage';

const BawsAppStateOverview = ({
  input: {  awsComponent, namespace, deploymentName }
}: { input: {  awsComponent:AWSComponent, namespace:string, deploymentName:string} }) => {
  const api = useApi(bawsApiRef);
  api.setBackendParams({
    appName:awsComponent.componentName,
    awsAccount:awsComponent.currentEnvironment.providerData.accountNumber,
    awsRegion:awsComponent.currentEnvironment.providerData.region,
    prefix: awsComponent.currentEnvironment.providerData.prefix,
    providerName: awsComponent.currentEnvironment.providerData.name
  });

  const [taskData, setTaskData] = useState<Task>({});
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<{ isError: boolean; errorMsg: string | null }>({ isError: false, errorMsg: null });


  function sleep(ms: number) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }


  const handleScaleDowndeployment = async () => {
    await api.scaleEKSDeployment({
      deploymentName: deploymentName,
      namespace: namespace,
      replicaCount: 0 // set replica =0
    });
    setLoading(true);

    console.log("Loading")


    setLoading(false)
  };
  const handleScaleUpdeployment = async () => {
    await api.scaleEKSDeployment({
      deploymentName: deploymentName,
      namespace: namespace,
      replicaCount: 3 // set replica > 0
    });
    setLoading(true);

    console.log("Loading")


    setLoading(false)
  };



  if (loading) {
    return (
      <InfoCard title="Application State">
        <LinearProgress />
        <Typography sx={{ color: '#645B59', mt: 2 }}>Loading current state...</Typography>
      </InfoCard>
    );
  }
  if (error.isError) {
    return <InfoCard title="Application State">{error.errorMsg}</InfoCard>;
  }
  if (loading) {
    return (
      <InfoCard title="Application State">
        <LinearProgress />
        <Typography sx={{ color: '#645B59', mt: 2 }}>Loading current state...</Typography>
      </InfoCard>
    );
  }
  if (error.isError) {
    return <InfoCard title="Application State">{error.errorMsg}</InfoCard>;
  }

  return (
    <InfoCard title="Application State">
      <CardContent>
        <Grid container direction="column" rowSpacing={2}>
          <Grid container>
            <Grid item xs={4}>
              <Typography sx={{ textTransform: 'uppercase', fontWeight: 'bold' }}>Status</Typography>
              {/* <Typography sx={{ mt: 1 }}>{taskData?.lastStatus ? taskData?.lastStatus : 'No Task Running'}</Typography> */}
            </Grid>
            <Divider orientation="vertical" flexItem sx={{ mr: '-1px' }} />
            <Grid item zeroMinWidth xs={4} sx={{ pl: 1, pr: 1 }}>
              <Typography sx={{ textTransform: 'uppercase', fontWeight: 'bold' }}> Deployment  Name </Typography>
              <Typography noWrap sx={{ mt: 1 }}>
                <IconButton sx={{ p: 0 }}>
                  <ContentCopyIcon></ContentCopyIcon>
                </IconButton>

                {/* {taskData?.taskArn ? taskData?.taskArn : 'No Task Running'} */}
              </Typography>
            </Grid>
            <Divider orientation="vertical" flexItem sx={{ mr: '-1px' }} />
            <Grid item xs={4} sx={{ pl: 1 }}>
              <Typography sx={{ textTransform: 'uppercase', fontWeight: 'bold' }}> Created At</Typography>
              <Typography sx={{ mt: 1 }}>
                {/* {taskData?.createdAt ? taskData?.createdAt.toString() : 'No Task Running'} */}
              </Typography>
            </Grid>
          </Grid>
          <Grid item>
            <Button
              sx={{ mr: 2 }}
              variant="outlined"
              size="small"
              // disabled={taskData.taskArn ? true : false}
              onClick={handleScaleUpdeployment}
            >
              Start Pods
            </Button>
            <Button
              sx={{ mr: 2 }}
              variant="outlined"
              size="small"
              // disabled={!taskData.taskArn}
              onClick={handleScaleDowndeployment}
            >
              Stop Pods
            </Button>
          </Grid>
        </Grid>
      </CardContent>
    </InfoCard>
  );
};

export const EksAppStateCard = () => {
  const awsAppLoadingStatus = useAsyncAwsApp();


  if (awsAppLoadingStatus.loading) {
    return <LinearProgress />
  } else if (awsAppLoadingStatus.component) {
    const env = awsAppLoadingStatus.component.currentEnvironment as AWSEKSAppDeploymentEnvironment;
    // const latestTaskDef =  env.app.taskDefArn.substring(0,env.app.taskDefArn.lastIndexOf(":"))  
    const input = {
      awsComponent: awsAppLoadingStatus.component,
      namespace: env.app.namespace,  // todo dynamically update
      deploymentName: env.app.deploymentName, // todo dynamically get

    };
    return <BawsAppStateOverview input={input} />
  } else {
    return <EmptyState missing="data" title="No state data to show" description="State data would show here" />
  }

  
};

