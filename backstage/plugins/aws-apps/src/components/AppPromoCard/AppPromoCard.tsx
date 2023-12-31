// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

import React, { ChangeEvent, useEffect, useState } from 'react';
import { EmptyState, InfoCard, } from '@backstage/core-components';
import { CatalogApi } from '@backstage/plugin-catalog-react';
import { Button, CardContent, FormControl, FormHelperText, Grid, InputLabel, LinearProgress, MenuItem, Select } from '@material-ui/core';
import { Alert, AlertTitle, Typography } from '@mui/material';
import { useAsyncAwsApp } from '../../hooks/useAwsApp';
import { AWSComponent, AwsDeploymentEnvironments } from '@aws/plugin-aws-apps-common-for-backstage';
import { useApi } from '@backstage/core-plugin-api';
import { catalogApiRef } from '@backstage/plugin-catalog-react';
import { CompoundEntityRef, Entity, EntityRelation, parseEntityRef } from '@backstage/catalog-model';
import { bawsApiRef } from '../../api';
import { AWSProviderParams } from '@aws/plugin-aws-apps-common-for-backstage';
import Backdrop from '@mui/material/Backdrop';
import CircularProgress from '@mui/material/CircularProgress';
import { ProviderType } from '../../helpers/constants';

const AppPromoCard = ({
  input: { awsComponent, catalogApi },
}: {
  input: { awsComponent: AWSComponent; catalogApi: CatalogApi };
}) => {
  const [envChoices, setEnvChoices] = useState<Entity[]>([]);
  const [selectedItem, setSelectedItem] = useState("");
  const [disabled, setDisabled] = useState(false);
  const [spinning, setSpinning] = useState(false);
  const [isPromotionSuccessful, setIsPromotionSuccessful] = useState(false);
  const [promotedEnvName, setPromotedEnvName] = useState("");
  const [promoteResultMessage, setPromoteResultMessage] = useState("");

  const api = useApi(bawsApiRef);
  api.setBackendParams({
    appName: awsComponent.componentName,
    awsAccount: awsComponent.currentEnvironment.providerData.accountNumber,
    awsRegion: awsComponent.currentEnvironment.providerData.region,
    prefix: awsComponent.currentEnvironment.providerData.prefix,
    providerName: awsComponent.currentEnvironment.providerData.name
  });

  function getHighestLevelEnvironment(currentEnvironments: AwsDeploymentEnvironments) {
    let highestLevel = 1;
    Object.keys(currentEnvironments).forEach(env => {
      if (highestLevel <= currentEnvironments[env].environment.level) {
        highestLevel = currentEnvironments[env].environment.level;

      }
    })
    return highestLevel;
  }

  function getApplicableEnvironments(
    catalogEntities: Entity[],
    envType: string,
    currentEnvironments: AwsDeploymentEnvironments): Entity[] {

    // by now, we got applicable environments for the same runtime and that we have yet to deploy on.
    const lowestEnvironmentLevel = getHighestLevelEnvironment(currentEnvironments);

    const currentEnvKeys = Object.keys(currentEnvironments);

    return catalogEntities
      .filter(en => {
        return (
          en.metadata["environment-type"] === envType &&
          !currentEnvKeys.includes(en.metadata.name) &&
          Number.parseInt(en.metadata["level"]?.toString()!) >= lowestEnvironmentLevel
        )
      })
      .sort(
        (a, b) => Number.parseInt(a.metadata['level']?.toString()!) - Number.parseInt(b.metadata['level']?.toString()!),
      );
  };

  const filterExpression = {
    'kind': "awsenvironment",
    // 'metadata.environment-type': component.currentEnvironment.environment.envType,
    // 'spec.system': component.currentEnvironment.environment.system, TODO: when system is implemented filter on similar system.
  };

  useEffect(() => {
    catalogApi.getEntities({ filter: filterExpression }).then(entities => {
      const data = getApplicableEnvironments(entities.items, awsComponent.currentEnvironment.environment.envType, awsComponent.environments);
      setEnvChoices(data);
      if (data && data[0]) {
        setSelectedItem(data[0].metadata.name);
      } else {
        setDisabled(true);
      }
    });
  }, []);

  const handleChange = (event: ChangeEvent<{ name?: string; value: unknown; }>) => {
    setSelectedItem((event.target.value as string))
  };

  async function getParameters(envProviderEntity: Entity, envName: string, providerName: string): Promise<{ [key: string]: string; }> {
    //For the current provider - set the API to the appropriate provider target

    api.setBackendParams({
      appName: awsComponent.componentName,
      awsAccount: envProviderEntity.metadata['aws-account']?.toString() || "",
      awsRegion: envProviderEntity.metadata['aws-region']?.toString() || "",
      prefix: envProviderEntity.metadata['prefix']?.toString() || "",
      providerName: envProviderEntity.metadata.name
    })

    const envType = envProviderEntity.metadata['env-type']?.toString().toLowerCase();
    if (envType === ProviderType.ECS) {
      const vpcParam = envProviderEntity.metadata["vpc"]?.toString() || "";
      const clusterParam = envProviderEntity.metadata["cluster-name"]?.toString() || "";
      const auditTableParam = envProviderEntity.metadata["audit-table"]?.toString() || "";
      const vpc = (await api.getSSMParameter({ ssmParamName: vpcParam })).Parameter?.Value || "";
      const cluster = (await api.getSSMParameter({ ssmParamName: clusterParam })).Parameter?.Value || "";
      const auditTable = (await api.getSSMParameter({ ssmParamName: auditTableParam })).Parameter?.Value || "";
      let parametersMap = {
        //'vpcParam': vpcParam,
        'TARGET_VPCID': vpc,
        //'clusterParam': clusterParam,
        'TARGET_ECS_CLUSTER_ARN': cluster,
        'TARGET_ENV_NAME': envName,
        'TARGET_ENV_PROVIDER_NAME': providerName,
        //'auditTableParam': auditTableParam,
        'TARGE_ENV_AUDIT': auditTable
      };
      return parametersMap;
    }
    else if (envType === ProviderType.EKS) {
      throw new Error("TO BE IMPLEMENTED - eks"); // TODO: Implement EKS support for AppPromoCard.tsx
    }
    else if (envType === ProviderType.SERVERLESS) {
      throw new Error("TO BE IMPLEMENTED - serverless"); // TODO: Implement Serverless support for AppPromoCard.tsx
    }
    else {
      throw new Error(`UNKNOWN PROVIDER TYPE" ${envType}`);
    }
  }

  type EnvironmentProviders = {
    providers: AWSProviderParams[];
  }

  async function getEnvProviders(): Promise<EnvironmentProviders> {
    let envProviders: EnvironmentProviders = { providers: [] };

    const selectedEnv = await catalogApi.getEntities({ filter: { 'kind': "awsenvironment", 'metadata.name': selectedItem } });
    const envEntity = selectedEnv.items[0];

    const envRequiresManualApproval = !!envEntity.metadata['deployment_requires_approval'];

    const envProviderRefs: EntityRelation[] | undefined = envEntity.relations?.filter(
      relation => parseEntityRef(relation?.targetRef).kind === 'awsenvironmentprovider')!;

    const providerEntities = await Promise.all(envProviderRefs.map(async (entityRef: { targetRef: string | CompoundEntityRef; }) => {
      const entity = await catalogApi.getEntityByRef(entityRef.targetRef);
      return entity;
    }));

    await Promise.all(providerEntities.map(async (et) => {
      const providerResolvedData = await getParameters(et!, envEntity.metadata.name, et?.metadata.name!);
      envProviders.providers.push(
        {
          environmentName: envEntity.metadata.name,
          envRequiresManualApproval,
          providerName: et?.metadata.name || '',
          awsAccount: et?.metadata['aws-account']?.toString() || '',
          awsRegion: et?.metadata['aws-region']?.toString() || '',
          prefix: et?.metadata['prefix']?.toString() || '',
          assumedRoleArn: et?.metadata['provisioning-role']?.toString() || '',
          parameters: providerResolvedData
        });
    }))

    return envProviders;
  }

  const handleCloseAlert = () => {
    setPromotedEnvName("");
  };

  const handleClick = () => {
    if (!selectedItem) {
      alert('Select an Environment');
      return;
    }

    setSpinning(true);
    setPromotedEnvName("");

    // Build a list of environment variables required to invoke a job to promote the app
    getEnvProviders().then(envProviders => {

      const promoBody = {
        envName: selectedItem,
        envRequiresManualApproval: envProviders.providers[0].envRequiresManualApproval,
        gitHost: awsComponent.gitHost,
        gitJobID: 'create-subsequent-environment-ci-config',
        gitProjectGroup: 'aws-app',
        gitAdminSecret: 'aad-admin-gitlab-secrets',
        gitRepoName: awsComponent.gitRepo.split('/')[1],
        providersData: envProviders.providers
      };

      // now call the API and submit the promo request
      api.promoteApp(promoBody).then(results => {
        setSpinning(false);
        setPromotedEnvName(selectedItem);
        if (results.message) {
          setPromoteResultMessage(results.message);
        }

        if (results.status === "SUCCESS") {
          // Remove promoted environment from dropdown
          const newEnvChoices = [...envChoices].filter(function (item) {
            return item.metadata.name !== selectedItem
          });

          if (newEnvChoices.length === 0) {
            setDisabled(true);
            setSelectedItem("");
          } else {
            setSelectedItem(newEnvChoices[0].metadata.name);
          }
          setEnvChoices(newEnvChoices);
          setIsPromotionSuccessful(true);

        } else {
          setIsPromotionSuccessful(false);
        }
      }).catch(err => {
        console.log(err);
        setSpinning(false);
        setPromotedEnvName(selectedItem);
        setIsPromotionSuccessful(false);
      })

    });

  }

  return (
    <InfoCard title="Promote Component">
      <CardContent>
        <Grid>
          <Grid container spacing={2}>
            <Grid item zeroMinWidth xs={12}>
              {isPromotionSuccessful && !!promotedEnvName && (
                <Alert sx={{ mb: 2 }} severity="success" onClose={handleCloseAlert}>
                  <AlertTitle>Success</AlertTitle>
                  <strong>{promotedEnvName}</strong> was successfully scheduled for promotion!
                  {!!promoteResultMessage && (<><br /><br />{promoteResultMessage}</>)}
                </Alert>
              )}
              {!isPromotionSuccessful && !!promotedEnvName && (
                <Alert sx={{ mb: 2 }} severity="error" onClose={handleCloseAlert}>
                  <AlertTitle>Error</AlertTitle>
                  Failed to schedule <strong>{promotedEnvName}</strong> promotion.
                  {!!promoteResultMessage && (<><br /><br />{promoteResultMessage}</>)}
                </Alert>
              )}
              <Typography sx={{ fontWeight: 'bold' }}>Select an Environment to promote this component:</Typography>
            </Grid>
            <Grid item zeroMinWidth xs={12}>
              <FormControl>
                <InputLabel id="demo-simple-select-helper-label">Environments</InputLabel>
                <Select
                  labelId="demo-simple-select-helper-label"
                  id="demo-simple-select-helper"
                  value={selectedItem}
                  label="Environment"
                  disabled={disabled}
                  onChange={handleChange}
                >
                  {
                    envChoices.map(entity => {
                      const env = entity.metadata.name;
                      return (<MenuItem key={"ID" + env} value={env}>{env}</MenuItem>)
                    })
                  }
                </Select>
                <FormHelperText>Select the environment you wish to promote this app.</FormHelperText>
              </FormControl>
            </Grid>
            <Grid item zeroMinWidth xs={12}>
              <Typography noWrap>
                <Button variant="contained" onClick={handleClick} disabled={disabled}>Promote</Button>
              </Typography>
            </Grid>
          </Grid>
        </Grid>
        <Backdrop
          sx={{ color: '#fff', zIndex: (theme) => theme.zIndex.drawer + 1 }}
          open={spinning}
        >
          <CircularProgress color="inherit" />
        </Backdrop>
      </CardContent>
    </InfoCard>
  );
};

export const AppPromoWidget = () => {
  const awsAppLoadingStatus = useAsyncAwsApp();
  const catalogApi = useApi(catalogApiRef);

  if (awsAppLoadingStatus.loading) {
    return <LinearProgress />;
  } else if (awsAppLoadingStatus.component) {
    const component = awsAppLoadingStatus.component
    const input = {
      awsComponent: component,
      catalogApi
    };

    return <AppPromoCard input={input} />;
  } else {
    return <EmptyState missing="data" title="Failed to load App Promo Card" description="Can't fetch data" />;
  }
};
