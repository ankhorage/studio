import type { DataSourceDiagnostic, GeneratedApiDefinition } from '@ankhorage/contracts';
import { createGeneratedApiDataSource } from '@ankhorage/data-sources';

import type { StudioManifest } from './index';

export type StudioGeneratedApiMutationResult =
  | {
      readonly ok: true;
      readonly manifest: StudioManifest;
      readonly diagnostics: readonly DataSourceDiagnostic[];
    }
  | {
      readonly ok: false;
      readonly manifest: StudioManifest;
      readonly diagnostics: readonly DataSourceDiagnostic[];
    };

export function upsertStudioGeneratedApi(
  manifest: StudioManifest,
  definition: GeneratedApiDefinition,
  previousId?: string,
): StudioGeneratedApiMutationResult {
  const collision = findGeneratedApiCollision(manifest, definition, previousId);
  if (collision) {
    return { ok: false, manifest, diagnostics: [collision] };
  }

  const projection = createGeneratedApiDataSource(definition);
  if (!projection.ok) {
    return { ok: false, manifest, diagnostics: projection.diagnostics };
  }

  const generatedApis = { ...(manifest.generatedApis ?? {}) };
  const dataSources = { ...(manifest.dataSources ?? {}) };
  if (previousId && previousId !== definition.id) {
    delete generatedApis[previousId];
    removeOwnedProjection(dataSources, previousId);
  }

  generatedApis[definition.id] = definition;
  dataSources[definition.id] = projection.data;
  return {
    ok: true,
    manifest: { ...manifest, generatedApis, dataSources },
    diagnostics: projection.diagnostics ?? [],
  };
}

export function deleteStudioGeneratedApi(manifest: StudioManifest, apiId: string): StudioManifest {
  if (manifest.generatedApis?.[apiId] === undefined) return manifest;

  const generatedApis = { ...(manifest.generatedApis ?? {}) };
  const dataSources = { ...(manifest.dataSources ?? {}) };
  delete generatedApis[apiId];
  removeOwnedProjection(dataSources, apiId);
  return { ...manifest, generatedApis, dataSources };
}

function findGeneratedApiCollision(
  manifest: StudioManifest,
  definition: GeneratedApiDefinition,
  previousId: string | undefined,
): DataSourceDiagnostic | null {
  const desired = manifest.generatedApis?.[definition.id];
  if (desired && definition.id !== previousId) {
    return collisionDiagnostic(definition.id, 'A generated API with this ID already exists.');
  }

  const source = manifest.dataSources?.[definition.id];
  if (!source) return null;
  if (
    source.kind === 'api' &&
    source.origin === 'generated' &&
    (source.generatedApiId === definition.id || source.generatedApiId === previousId)
  ) {
    return null;
  }

  return collisionDiagnostic(
    definition.id,
    'This ID is already used by another canonical data source.',
  );
}

function collisionDiagnostic(apiId: string, message: string): DataSourceDiagnostic {
  return {
    code: 'duplicate-data-source-id',
    dataSourceId: apiId,
    message,
    path: 'id',
    severity: 'error',
  };
}

function removeOwnedProjection(
  dataSources: Record<string, NonNullable<StudioManifest['dataSources']>[string]>,
  apiId: string,
): void {
  const source = dataSources[apiId];
  if (source?.kind === 'api' && source.origin === 'generated' && source.generatedApiId === apiId) {
    delete dataSources[apiId];
  }
}
