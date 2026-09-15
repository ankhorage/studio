import type { InfraOutput } from '@ankhorage/contracts/infra';
import type { MediaStorageAdapter } from '@ankhorage/contracts/storage';
import { createContractsSupabaseStorageAdapter } from '@ankhorage/supabase-storage/contracts';

import type { ProjectManager } from '../orchestrator/projectManager';

export interface ProjectMediaStorageContext {
  readonly adapter: MediaStorageAdapter;
  readonly bucket: string;
}

/*** Resolve the active project's canonical authoring-media storage adapter from manifest and Infra outputs. */
export async function resolveProjectMediaStorage(args: {
  readonly projectId: string;
  readonly projectManager: ProjectManager;
  readonly workspaceRoot: string;
}): Promise<ProjectMediaStorageContext> {
  const manifest = await args.projectManager.getProjectManifest(args.projectId);
  const objectStorage = manifest.infra.environments.local.objectStorage;
  const bucket = objectStorage?.buckets?.find((value) => value.trim().length > 0)?.trim();
  if (!objectStorage || !bucket) {
    throw new Error('Configure an infra.environments.local.objectStorage bucket before importing media.');
  }
  if (objectStorage.provider !== 'supabase') {
    throw new Error(
      `Studio media ingestion does not support object-storage provider '${objectStorage.provider}' yet.`,
    );
  }

  const outputs = await args.projectManager.getInfrastructureOutputs(args.projectId);
  const url = readPublicEnvironmentOutput(outputs, 'EXPO_PUBLIC_SUPABASE_URL');
  const anonKey = readPublicEnvironmentOutput(outputs, 'EXPO_PUBLIC_SUPABASE_ANON_KEY');
  if (!url || !anonKey) throw new Error('Run Infra Up before importing media.');

  return { adapter: createContractsSupabaseStorageAdapter({ url, anonKey, bucket }), bucket };
}

/*** Read one non-empty public Infra output by its application environment-variable name. */
function readPublicEnvironmentOutput(
  outputs: readonly InfraOutput[],
  environmentVariable: string,
): string | undefined {
  const output = outputs.find(
    (candidate) =>
      candidate.visibility === 'public' && candidate.environmentVariable === environmentVariable,
  );
  if (!output || output.visibility !== 'public') return undefined;
  const value = String(output.value).trim();
  return value.length > 0 ? value : undefined;
}
