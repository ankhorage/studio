import type {
  SecretMetadata,
  SecretPayload,
  SecretStoreResult,
} from '@ankhorage/contracts/secrets';

/*** Minimal secret-store port required by Studio's host-side Deploy integration. */
export interface ProjectDeploySecretStore {
  list(input: {
    readonly projectId: string;
    readonly environment: string;
  }): Promise<SecretStoreResult<readonly SecretMetadata[]>>;
  resolve(input: {
    readonly projectId: string;
    readonly environment: string;
    readonly ref: string;
  }): Promise<SecretStoreResult<SecretPayload>>;
}
