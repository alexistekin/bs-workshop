import React, { ReactNode } from 'react';
import { EntityAboutCard,EntityLinksCard, EntityLayout, EntitySwitch } from '@backstage/plugin-catalog';
import {
  EntityCatalogGraphCard
} from '@backstage/plugin-catalog-graph';
import { Button, Grid } from '@material-ui/core';
import { Entity } from '@backstage/catalog-model';
export interface AwsEnvironmentProviderPageProps {
  children?: ReactNode
}
import {
  isGithubActionsAvailable,
  EntityGithubActionsContent,
} from '@backstage/plugin-github-actions';
import { isGitlabAvailable, EntityGitlabContent } from '@immobiliarelabs/backstage-plugin-gitlab';
import { EmptyState } from '@backstage/core-components';
import { EntityTechdocsContent } from '@backstage/plugin-techdocs';
import { TechDocsAddons } from '@backstage/plugin-techdocs-react';
import { ReportIssue } from '@backstage/plugin-techdocs-module-addons-contrib';
import {EntityDeleteProviderCard} from '../../plugin';

const isCicdApplicable = (entity: Entity) => {
  return isGitlabAvailable(entity) || isGithubActionsAvailable(entity);
};

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

/** @public */
export function AwsECSEnvironmentProviderPage(/* {children}: AwsEnvironmentProviderPageProps */) {
  return (
    <EntityLayout>
    <EntityLayout.Route path="/" title="Overview">
    <Grid container spacing={3} alignItems="stretch">
      <Grid item md={6}>
        <EntityAboutCard variant="gridItem" />
      </Grid>
      <Grid item md={6} xs={12}>
        <EntityCatalogGraphCard variant="gridItem" height={400} />
      </Grid>
      <Grid item md={6} xs={12}>
        <EntityLinksCard />
      </Grid>
      <Grid item md={6} xs={12}>
        <EntityDeleteProviderCard />
      </Grid>
    </Grid>
    </EntityLayout.Route>
    <EntityLayout.Route path="/ci-cd" title="CI/CD" if={isCicdApplicable}>
      {cicdContent}
    </EntityLayout.Route>
    <EntityLayout.Route path="/docs" title="Docs">
        <EntityTechdocsContent>
        <TechDocsAddons>
          <ReportIssue />
        </TechDocsAddons>
      </EntityTechdocsContent>
    </EntityLayout.Route>
  </EntityLayout>
  );
}
