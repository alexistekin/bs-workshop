import React, { ReactNode } from 'react';
import { Entity } from '@backstage/catalog-model';
import { EntityLayout, EntitySwitch } from '@backstage/plugin-catalog';
import {AwsRDSResourcePage} from '../AwsRDSResourcePage/AwsRDSResourcePage';
import { isGitlabAvailable, EntityGitlabContent } from '@immobiliarelabs/backstage-plugin-gitlab';
import {
  isGithubActionsAvailable,
  EntityGithubActionsContent,
} from '@backstage/plugin-github-actions';
import { EmptyState } from '@backstage/core-components';
import { Button, Grid } from '@material-ui/core';
import { EntityAppPromoCard, EntityDeleteAppCard } from '../../plugin';


interface AwsResourcePageProps {
  children: ReactNode;
}

export function isResourceType(resourceType:string):(entity: Entity) => boolean {
  return (entity: Entity): boolean => {
    let subType='N/A';
    if (entity?.metadata?.['resource-type'])
      subType = entity?.metadata?.['resource-type'].toString();
    return subType==resourceType;
  };
};

const isCicdApplicable = (entity: Entity) => {
  return isGitlabAvailable(entity) || isGithubActionsAvailable(entity);
};

/** @public */
export function AwsResourcePage(_props: AwsResourcePageProps) {

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
  
  const managementContent = (
    <Grid container spacing={1} alignItems="stretch">
    <Grid item md={6} xs={6}>
      <EntityAppPromoCard />
    </Grid>
    <Grid item md={6} xs={6}>
      <EntityDeleteAppCard/>
    </Grid>
  </Grid>
  );
  
  const AwsRDSResourceEntityPage = (
    <>
        {_props.children}
        <EntityLayout>
        <EntityLayout.Route path="/" title="Overview">
          <AwsRDSResourcePage>
          </AwsRDSResourcePage>
        </EntityLayout.Route>
        <EntityLayout.Route path="/ci-cd" title="CI/CD" if={isCicdApplicable}>
          {cicdContent}
        </EntityLayout.Route>
        <EntityLayout.Route path="/management" title="Management">
        {managementContent}
    </EntityLayout.Route>
      </EntityLayout>
     </>
  )

  return (
    <EntitySwitch>
      <EntitySwitch.Case if={isResourceType('aws-rds')} >
        {AwsRDSResourceEntityPage}
      </EntitySwitch.Case>
      {/* <EntitySwitch.Case if={isResourceType('aws-s3')}>
        {AwsS3EntityPage}
      </EntitySwitch.Case>
      <EntitySwitch.Case if={isResourceType('aws-sqs')}>
        {AwsSQSEntityPage}
      </EntitySwitch.Case> */}
    </EntitySwitch>
  );
}


