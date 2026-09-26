import type { SecretPayload } from '@ankhorage/contracts/secrets';
import type { DeploymentCredentialReference } from '@ankhorage/deploy';
import { asNonEmptyString } from '@ankhorage/utility/value';

/*** Serialize one Deploy credential payload using provider-specific token semantics when required. */
export function serializeProjectDeploySecret(
  reference: DeploymentCredentialReference,
  payload: SecretPayload,
): string | null {
  if (reference.provider === 'eas' && reference.kind === 'expo-token') {
    return asNonEmptyString(payload.token) ?? null;
  }
  return JSON.stringify(payload);
}
