import { CatalogClient } from '@backstage/catalog-client';
import { createBuiltinActions, createRouter } from '@backstage/plugin-scaffolder-backend';
import { Router } from 'express';
import type { PluginEnvironment } from '../types';
import { ScmIntegrations } from '@backstage/integration';
import {
  createRepoAccessTokenAction,
  createSecretAction,
  createS3BucketAction,
  getEnvProvidersAction,
  getComponentInfoAction,
  getSsmParametersAction,
  getPlatformParametersAction
} from '@aws/plugin-scaffolder-backend-aws-apps-for-backstage';
import {
  // createZipAction,
  // createSleepAction,
  createWriteFileAction,
  createAppendFileAction,
  // createMergeJSONAction,
  // createMergeAction,
  // createParseFileAction,
  // createSerializeYamlAction,
  // createSerializeJsonAction,
  // createJSONataAction,
  // createYamlJSONataTransformAction,
  // createJsonJSONataTransformAction,
  // createReplaceInFileAction,
} from '@roadiehq/scaffolder-backend-module-utils';

export default async function createPlugin(
  env: PluginEnvironment,
): Promise<Router> {
  const catalogClient = new CatalogClient({
    discoveryApi: env.discovery,
  });

const integrations = ScmIntegrations.fromConfig(env.config);
const builtInActions = createBuiltinActions({
  integrations,
  catalogClient,
  reader: env.reader,
  config: env.config,
});

const actions = [
  // createZipAction(),
  // createSleepAction(),
  createWriteFileAction(),
  createAppendFileAction(),
  // createMergeJSONAction({}),
  // createMergeAction(),
  // createParseFileAction(),
  // createSerializeYamlAction(),
  // createSerializeJsonAction(),
  // createJSONataAction(),
  // createYamlJSONataTransformAction(),
  // createJsonJSONataTransformAction(),
  // createReplaceInFileAction(),
   ...builtInActions,
  createRepoAccessTokenAction({ integrations, envConfig:env.config }),
  createS3BucketAction(),
  createSecretAction( {envConfig:env.config}),
  getEnvProvidersAction({ catalogClient }),
  getComponentInfoAction(),
  getSsmParametersAction(),
  getPlatformParametersAction({envConfig:env.config})
];

  return await createRouter({
    logger: env.logger,
    config: env.config,
    database: env.database,
    reader: env.reader,
    catalogClient,
    identity: env.identity,
    permissions: env.permissions,
    actions
  });
}
