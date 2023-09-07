import React from 'react';
import { Grid } from '@material-ui/core';
import { EntityAboutCard } from '@backstage/plugin-catalog';
import { EntityGeneralInfoCard, EntityEksAppStateCard, EntityAppLinksCard, EntityAppConfigCardEks } from '../../plugin';
import {
  EntityCatalogGraphCard
} from '@backstage/plugin-catalog-graph';

interface AwsEKSAppPageProps {
  
}

/** @public */
export function AwsEKSAppPage(_props: AwsEKSAppPageProps) {
  const awsEKSAppViewContent = (
    <Grid container spacing={3} alignItems="stretch">
      <Grid item md={6}>
        <EntityAboutCard variant="gridItem" />
      </Grid>
      <Grid item md={6} xs={12}>
        <EntityCatalogGraphCard variant="gridItem" height={400} />
      </Grid>
      <Grid item md={6} xs={12}>
        <EntityAppLinksCard />
      </Grid>
      <Grid item md={6} xs={12}>
        <EntityGeneralInfoCard appPending={false}/>
      </Grid>
      <Grid item md={6} xs={12}>
        <EntityEksAppStateCard></EntityEksAppStateCard>
      </Grid>
      <Grid item md={6} xs={12}>
        <EntityAppConfigCardEks></EntityAppConfigCardEks>
      </Grid>
      {/* <Grid item md={12} xs={12}>
        <EntityInfrastructureInfoCard />
      </Grid> */}
    </Grid>
  );
  
  return (
    <>
    {awsEKSAppViewContent}
    </>
  );
}
