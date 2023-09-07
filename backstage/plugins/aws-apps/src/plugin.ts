// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

import {
  createPlugin,
  createApiFactory,
  configApiRef,
  createComponentExtension,
  fetchApiRef,
} from '@backstage/core-plugin-api';
import { Entity } from '@backstage/catalog-model';
import { rootRouteRef } from './routes';
import { AADApiClient, bawsApiRef } from './api';

export const isBAWSAppAvailable = (entity: Entity) => entity?.spec?.type === 'aws-app';
export const isAnnotationsAvailable = (entity: Entity) => entity?.metadata?.annotations;
export const isLabelsAvailable = (entity: Entity) => entity?.metadata?.labels;

export const bawsPlugin = createPlugin({
  id: 'aws-apps',
  apis: [
    createApiFactory({
      api: bawsApiRef,
      deps: { configApi: configApiRef, fetchApi: fetchApiRef },
      factory: ({ configApi, fetchApi }) => new AADApiClient({ configApi, fetchApi}),
    }),
  ],
  routes: {
    root: rootRouteRef,
  },
});

export const EntityLabelTable = bawsPlugin.provide(
  createComponentExtension({
    name: 'EntityLabelTable',
    component: {
      lazy: () => import('./components/LabelTable/LabelTable').then(m => m.LabelWidget),
    },
  }),
);

export const EntityAuditTable = bawsPlugin.provide(
  createComponentExtension({
    name: 'EntityAuditTable',
    component: {
      lazy: () => import('./components/AuditTable/AuditTable').then(m => m.AuditWidget),
    },
  }),
);

export const EntityEnvironmentSelector = bawsPlugin.provide(
  createComponentExtension({
    name: 'EnvironmentSelector',
    component: {
      lazy: () => import('./components/EnvironmentSelector/EnvironmentSelector').then(m => m.EnvironmentSelectorWidget),
    },
  }),
);

export const EntityAnnotationTypeTable = bawsPlugin.provide(
  createComponentExtension({
    name: 'EntityAnnotationTypeTable',
    component: {
      lazy: () => import('./components/AnnotationTypeTable/AnnotationTypeTable').then(m => m.AnnotationWidget),
    },
  }),
);

export const EntityAppStateCard = bawsPlugin.provide(
  createComponentExtension({
    name: 'AppStateCard',
    component: {
      lazy: () => import('./components/AppStateCard/AppStateCard').then(m => m.AppStateCard),
    },
  }),
);

export const EntityEksAppStateCard = bawsPlugin.provide(
  createComponentExtension({
    name: 'EksAppStateCard',
    component: {
      lazy: () => import('./components/EksAppStateCard/EksAppStateCard').then(m => m.EksAppStateCard),
    },
  }),
);

export const EntityAppStateCardCloudFormation = bawsPlugin.provide(
  createComponentExtension({
    name: 'AppStateCardCloudFormation',
    component: {
      lazy: () => import('./components/AppStateCardCloudFormation/AppStateCardCloudFormation').then(m => m.AppStateCard),
    },
  }),
);

export const EntityGeneralInfoCard = bawsPlugin.provide(
  createComponentExtension({
    name: 'GeneralInfoCard',
    component: {
      lazy: () => import('./components/GeneralInfoCard/GeneralInfoCard').then(m => m.GeneralInfoCard),
    },
  }),
);

export const EntityAppPromoCard = bawsPlugin.provide(
  createComponentExtension({
    name: 'AppPromoCard',
    component: {
      lazy: () => import('./components/AppPromoCard/AppPromoCard').then(m => m.AppPromoWidget),
    },
  }),
);

export const EntityAppLinksCard = bawsPlugin.provide(
  createComponentExtension({
    name: 'AppLinksCard',
    component: {
      lazy: () => import('./components/AppLinksCard/AppLinksCard').then(m => m.AppLinksCard),
    },
  }),
);

export const AppCatalogPage = bawsPlugin.provide(
  createComponentExtension({
    name: 'AppCatalogPage',
    component: {
      lazy: () => import('./components/AppCatalogPage/AppCatalogPage').then(m => m.AppCatalogPage),
    },
  }),
);

export const EntityCloudwatchLogsTable = bawsPlugin.provide(
  createComponentExtension({
    name: 'EntityCloudwatchLogsTable',
    component: {
      lazy: () => import('./components/CloudwatchLogsTable/CloudwatchLogsTable').then(m => m.CloudwatchLogsWidget),
    },
  }),
);

export const EntityInfrastructureInfoCard = bawsPlugin.provide(
  createComponentExtension({
    name: 'InfrastructureInfoCard',
    component: {
      lazy: () => import('./components/InfrastructureCard/InfrastructureCard').then(m => m.InfrastructureCard),
    },
  }),
);

export const EntityAppConfigCard = bawsPlugin.provide(
  createComponentExtension({
    name: 'AppConfigCard',
    component: {
      lazy: () => import('./components/AppConfigCard/AppConfigCard').then(m => m.AppConfigCard),
    },
  }),
);
export const EntityAppConfigCardEks = bawsPlugin.provide(
  createComponentExtension({
    name: 'AppConfigCardEks',
    component: {
      lazy: () => import('./components/AppConfigCardEks/AppConfigCardEks').then(m => m.AppConfigCardEks),
    },
  }),
);

export const EntityDeleteAppCard = bawsPlugin.provide(
  createComponentExtension({
    name: 'DeleteAppCard',
    component: {
      lazy: () => import('./components/DeleteComponentCard/DeleteComponentCard').then(m => m.DeleteComponentCard),
    },
  }),
);

export const EntityDeleteProviderCard = bawsPlugin.provide(
  createComponentExtension({
    name: 'DeleteProviderCard',
    component: {
      lazy: () => import('./components/DeleteProviderCard/DeleteProviderCard').then(m => m.DeleteProviderCard),
    },
  }),
);

export const EntityResourceBindingCard = bawsPlugin.provide(
  createComponentExtension({
    name: 'ResourceBindingCard',
    component: {
      lazy: () => import('./components/ResourceBindingCard/ResourceBinding').then(m => m.ResourceBindingCardWidget),
    },
  }),
);

export const AwsAppPage = bawsPlugin.provide(
  createComponentExtension({
    name: 'AwsAppPage',
    component: {
      lazy: () => import('./pages/AwsAppPage/AwsAppPage').then(m => m.AwsAppPage),
    },
  }),
);

export const AwsComponentPage = bawsPlugin.provide(
  createComponentExtension({
    name: 'AwsComponentPage',
    component: {
      lazy: () => import('./pages/AwsComponentPage/AwsComponentPage').then(m => m.AwsComponentPage),
    },
  }),
);

export const AwsEnvironmentPage = bawsPlugin.provide(
  createComponentExtension({
    name: 'AwsEnvironmentPage',
    component: {
      lazy: () => import('./pages/AwsEnvironmentPage/AwsEnvironmentPage').then(m => m.AwsEnvironmentPage),
    },
  }),
);

export const AwsEnvironmentProviderPage = bawsPlugin.provide(
  createComponentExtension({
    name: 'AwsEnvironmentProviderPage',
    component: {
      lazy: () => import('./pages/AwsEnvironmentProviderPage/AwsEnvironmentProviderPage').then(m => m.AwsEnvironmentProviderPage),
    },
  }),
);
