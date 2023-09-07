import { EntityAboutCard,EntityLinksCard, EntityLayout } from '@backstage/plugin-catalog';
import { Grid } from '@material-ui/core';
import React, { ReactNode } from 'react';
import {
  EntityCatalogGraphCard
} from '@backstage/plugin-catalog-graph';

export interface AwsEnvironmentPageProps {
  children?: ReactNode
}
import { EntityTechdocsContent } from '@backstage/plugin-techdocs';
import { TechDocsAddons } from '@backstage/plugin-techdocs-react';
import { ReportIssue } from '@backstage/plugin-techdocs-module-addons-contrib';

/** @public */
export function AwsEnvironmentPage(/*{children}: AwsEnvironmentPageProps */) {
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
      </Grid>
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
