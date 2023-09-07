import React, { ReactNode } from 'react';
import { EntityLayout, EntitySwitch } from '@backstage/plugin-catalog';
import { Entity } from '@backstage/catalog-model';
import { AwsECSAppPage } from '../AwsECSAppPage/AwsECSAppPage'
import { AwsEKSAppPage } from '../AwsEKSAppPage/AwsEKSAppPage'
import { AwsServerlessAppPage } from '../AwsServerlessAppPage/AwsServerlessAppPage'
import { EntityAppPromoCard, EntityAuditTable, EntityCloudwatchLogsTable, EntityDeleteAppCard, EntityResourceBindingCard } from '../../plugin';
import { Button, Grid } from '@material-ui/core';
import {
  isGithubActionsAvailable,
  EntityGithubActionsContent,
} from '@backstage/plugin-github-actions';
import { isGitlabAvailable, EntityGitlabContent } from '@immobiliarelabs/backstage-plugin-gitlab';
import { EmptyState } from '@backstage/core-components';
import { useAsyncAwsApp } from '../../hooks/useAwsApp';
import { LinearProgress } from '@material-ui/core';
import { GenericAWSEnvironment } from '@aws/plugin-aws-apps-common-for-backstage';

interface AwsAppPageProps {
  children: ReactNode;
}

const isCicdApplicable = (entity: Entity) => {
  return isGitlabAvailable(entity) || isGithubActionsAvailable(entity);
};

export function isAppType(appType: string, env: GenericAWSEnvironment): (entity: Entity) => boolean {
  return (/*entity: Entity*/): boolean => {
    // ecs or eks or serverless
    return env.providerData.providerType === appType;
  };
};

export const isLogsAvailable = (_entity: Entity): boolean => {
  return true;
  // return !!entity?.metadata?.['app-env']['env1']['logs'] ||
  // 'serverless-rest-api' === entity?.metadata?.annotations?.['aws.amazon.com/baws-component-subtype'];
};


/** @public */
export function AwsAppPage(_props: AwsAppPageProps) {
  const awsAppLoadingStatus = useAsyncAwsApp();


  const awsAppLogsContent = (
    <Grid container spacing={3} alignItems="stretch">
      <Grid item md={12} xs={12}>
        <EntityCloudwatchLogsTable />
      </Grid>
    </Grid>
  );

  const auditContent = (
    <Grid container spacing={1} alignItems="stretch">
      <Grid item md={12} xs={12}>
        <EntityAuditTable />
      </Grid>
    </Grid>
  );

  const managementContent = (
    <Grid container spacing={1} alignItems="stretch">
      <Grid item md={6} xs={6}>
        <EntityAppPromoCard />
      </Grid>
      <Grid item md={6} xs={6}>
        <EntityDeleteAppCard />
      </Grid>
      <Grid item md={12} xs={12} >
        <EntityResourceBindingCard />
      </Grid>
    </Grid>
  );

  const cicdContent = (
    // This is an example of how you can implement your company's logic in entity page.
    // You can for example enforce that all components of type 'service' should use GitHubActions
    <EntitySwitch>
      <EntitySwitch.Case if={isGithubActionsAvailable}>
        <EntityGithubActionsContent />
      </EntitySwitch.Case>
      <EntitySwitch.Case if={isGitlabAvailable}>
        <EntityGitlabContent />
      </EntitySwitch.Case>

      <EntitySwitch.Case>
        <EmptyState
          title="No CI/CD available for this entity"
          missing="info"
          description="You need to add an annotation to your component if you want to enable CI/CD for it. You can read more about annotations in Backstage by clicking the button below."
          action={
            <Button
              variant="contained"
              color="primary"
              href="https://backstage.io/docs/features/software-catalog/well-known-annotations"
            >
              Read more
            </Button>
          }
        />
      </EntitySwitch.Case>
    </EntitySwitch>
  );

  const AwsECSAppEntityPage = (
    <>
      {_props.children}
      <EntityLayout>
        <EntityLayout.Route path="/" title="Overview">
          <AwsECSAppPage />
        </EntityLayout.Route>
        <EntityLayout.Route path="/ci-cd" title="CI/CD" if={isCicdApplicable}>
          {cicdContent}
        </EntityLayout.Route>
        <EntityLayout.Route path="/logs" title="App Logs" if={isLogsAvailable}>
          {awsAppLogsContent}
        </EntityLayout.Route>
        <EntityLayout.Route path="/management" title="Management">
          {managementContent}
        </EntityLayout.Route>
        <EntityLayout.Route path="/audit" title="Audit">
          {auditContent}
        </EntityLayout.Route>
      </EntityLayout>
    </>
  )

  const AwsEKSAppEntityPage = (
    <>
      {_props.children}
      <EntityLayout>
        <EntityLayout.Route path="/" title="Overview">
          <AwsEKSAppPage />
        </EntityLayout.Route>
        <EntityLayout.Route path="/ci-cd" title="CI/CD" if={isCicdApplicable}>
          {cicdContent}
        </EntityLayout.Route>
        <EntityLayout.Route path="/logs" title="App Logs" if={isLogsAvailable}>
          {awsAppLogsContent}
        </EntityLayout.Route>
        <EntityLayout.Route path="/audit" title="Audit">
          {auditContent}
        </EntityLayout.Route>
      </EntityLayout>
    </>
  )

  const AwsServerlessAppEntityPage = (
    <>
      {_props.children}
      <EntityLayout>
        <EntityLayout.Route path="/" title="Overview">
          <AwsServerlessAppPage />
        </EntityLayout.Route>
        <EntityLayout.Route path="/ci-cd" title="CI/CD" if={isCicdApplicable}>
          {cicdContent}
        </EntityLayout.Route>
        <EntityLayout.Route path="/logs" title="App Logs" if={isLogsAvailable}>
          {awsAppLogsContent}
        </EntityLayout.Route>
        <EntityLayout.Route path="/management" title="Management">
          {managementContent}
        </EntityLayout.Route>
        <EntityLayout.Route path="/audit" title="Audit">
          {auditContent}
        </EntityLayout.Route>
      </EntityLayout>
    </>

  )

  if (awsAppLoadingStatus.loading) {
    return <LinearProgress />
  } else if (awsAppLoadingStatus.component) {
    const env = awsAppLoadingStatus.component.currentEnvironment;
    return (
      <EntitySwitch>
        <EntitySwitch.Case if={isAppType('ecs', env)} >
          {AwsECSAppEntityPage}
        </EntitySwitch.Case>
        <EntitySwitch.Case if={isAppType('eks', env)}>
          {AwsEKSAppEntityPage}
        </EntitySwitch.Case>
        <EntitySwitch.Case if={isAppType('serverless', env)}>
          {AwsServerlessAppEntityPage}
        </EntitySwitch.Case>
      </EntitySwitch>
    );
  }
  else {
    return <EmptyState missing="data" title="Failed to load environment entity data" description="An error occurred when trying to load entity environment data. See the environment entity yaml file definitions to troubleshoot." />
  }
}
