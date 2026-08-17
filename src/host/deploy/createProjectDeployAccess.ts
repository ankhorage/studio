import type { SecretMetadata } from '@ankhorage/contracts/secrets';
import type { DeploymentCredentialReference } from '@ankhorage/deploy';
import type { ProjectReleaseAccess } from '@ankhorage/deploy/project';

import type { ProjectDeployRuntimeInput } from '../../projectDeployRuntimeInput';
import type { ProjectDeploySecretStore } from './ProjectDeploySecretStore';
import { serializeProjectDeploySecret } from './serializeProjectDeploySecret';

export async function createProjectDeployAccess(options: {
  readonly projectId: string;
  readonly runtime: ProjectDeployRuntimeInput;
  readonly secretStore: ProjectDeploySecretStore;
}): Promise<ProjectReleaseAccess> {
  const listed = await options.secretStore.list({
    projectId: options.projectId,
    environment: options.runtime.environment,
  });
  if (!listed.ok) {
    throw new Error(`Deployment secret metadata unavailable: ${listed.error.code}.`);
  }

  const credentials = listed.data.flatMap(toCredentialReference);
  const allowed = new Map(credentials.map((credential) => [credential.id, credential]));
  return {
    credentials,
    resolveSecret: async (reference) => resolveAllowedSecret(options, allowed, reference),
    ...(options.runtime.android === undefined ? {} : { android: options.runtime.android }),
    ...(options.runtime.ios === undefined ? {} : { ios: options.runtime.ios }),
    ...(options.runtime.web === undefined ? {} : { web: options.runtime.web }),
  };
}

function toCredentialReference(metadata: SecretMetadata): readonly DeploymentCredentialReference[] {
  return metadata.provider === undefined
    ? []
    : [{ id: metadata.ref, provider: metadata.provider, kind: metadata.kind }];
}

async function resolveAllowedSecret(
  options: {
    readonly projectId: string;
    readonly runtime: ProjectDeployRuntimeInput;
    readonly secretStore: ProjectDeploySecretStore;
  },
  allowed: ReadonlyMap<string, DeploymentCredentialReference>,
  reference: DeploymentCredentialReference,
): Promise<string | null> {
  const known = allowed.get(reference.id);
  if (known === undefined) return null;
  if (known.provider !== reference.provider || known.kind !== reference.kind) return null;

  const resolved = await options.secretStore.resolve({
    projectId: options.projectId,
    environment: options.runtime.environment,
    ref: reference.id,
  });
  if (!resolved.ok) return null;
  return serializeProjectDeploySecret(reference, resolved.data);
}
