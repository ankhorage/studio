import type {
  SecretMetadata,
  SecretPayload,
  SecretStoreResult,
} from '@ankhorage/contracts/secrets';

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
