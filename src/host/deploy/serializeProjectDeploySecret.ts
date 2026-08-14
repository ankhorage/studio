import type { SecretPayload } from '@ankhorage/contracts/secrets';
import type { DeploymentCredentialReference } from '@ankhorage/deploy';

export function serializeProjectDeploySecret(
  reference: DeploymentCredentialReference,
  payload: SecretPayload,
): string | null {
  if (reference.provider === 'eas' && reference.kind === 'expo-token') {
    return nonEmpty(payload.token);
  }
  return JSON.stringify(payload);
}

function nonEmpty(value: string | undefined): string | null {
  const normalized = value?.trim();
  return normalized === undefined || normalized.length === 0 ? null : normalized;
}
