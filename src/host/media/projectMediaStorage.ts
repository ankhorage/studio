import type { MediaStorageAdapter } from '@ankhorage/contracts/storage';
import { readProjectInfrastructureEnvironment } from '@ankhorage/infra/project';
import { createContractsSupabaseStorageAdapter } from '@ankhorage/supabase-storage/contracts';

import type { ProjectManager } from '../orchestrator/projectManager';
import { getProjectPath } from '../orchestrator/projectPaths';

export interface ProjectMediaStorageContext {
  readonly adapter: MediaStorageAdapter;
  readonly bucket: string;
}

export async function resolveProjectMediaStorage(args: {
  readonly projectId: string;
  readonly projectManager: ProjectManager;
  readonly workspaceRoot: string;
}): Promise<ProjectMediaStorageContext> {
  const manifest = await args.projectManager.getProjectManifest(args.projectId);
  const { storage } = manifest.infra;
  const bucket = storage?.buckets.find((value) => value.trim().length > 0)?.trim();
  if (!storage || !bucket)
    throw new Error('Configure an infra.storage bucket before importing media.');
  if (storage.provider !== 'auto') {
    throw new Error(
      `Studio media ingestion does not support storage provider '${storage.provider}' yet.`,
    );
  }
  const usesSupabase =
    manifest.infra.auth?.provider === 'supabase' ||
    manifest.infra.database?.provider === 'supabase';
  if (!usesSupabase)
    throw new Error('Storage provider auto cannot resolve a media storage adapter.');
  const status = await args.projectManager.getInfrastructureStatus(args.projectId);
  if (!status.target) throw new Error('Run infrastructure generation before importing media.');
  const environment = await readProjectInfrastructureEnvironment({
    keys: [
      'EXPO_PUBLIC_SUPABASE_URL',
      'SUPABASE_URL',
      'EXPO_PUBLIC_SUPABASE_ANON_KEY',
      'SUPABASE_ANON_KEY',
    ],
    projectPath: getProjectPath(args.workspaceRoot, args.projectId),
    target: status.target,
  });
  const url = environment.EXPO_PUBLIC_SUPABASE_URL?.trim() ?? environment.SUPABASE_URL?.trim();
  const anonKey =
    environment.EXPO_PUBLIC_SUPABASE_ANON_KEY?.trim() ?? environment.SUPABASE_ANON_KEY?.trim();
  if (!url || !anonKey) throw new Error('Run Infra Up before importing media.');
  return { adapter: createContractsSupabaseStorageAdapter({ url, anonKey, bucket }), bucket };
}
