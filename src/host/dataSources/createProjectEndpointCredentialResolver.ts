import type { CredentialRef } from '@ankhorage/contracts/data';
import type { SecretPayload } from '@ankhorage/contracts/secrets';
import type {
  EndpointTestCredential,
  EndpointTestCredentialResolver,
} from '@ankhorage/data-sources';

import type { ProjectSecretService } from '../secrets/projectSecretService';

export function createProjectEndpointCredentialResolver(args: {
  readonly projectId: string;
  readonly service: Pick<ProjectSecretService, 'resolve'>;
  readonly environment?: string;
}): EndpointTestCredentialResolver {
  return async (credential) => {
    const result = await args.service.resolve({
      projectId: args.projectId,
      environment: args.environment,
      ref: credential.id,
    });
    return result.ok ? mapCredential(credential, result.data) : undefined;
  };
}

function mapCredential(
  credential: CredentialRef,
  payload: SecretPayload,
): EndpointTestCredential | undefined {
  if (credential.kind === 'bearer' || credential.kind === 'oauth2') {
    const token = payload.token ?? payload.accessToken ?? payload.value;
    return token ? { headers: { authorization: `Bearer ${token}` } } : undefined;
  }
  if (credential.kind === 'basic') {
    const { username, password } = payload;
    return username && password
      ? { headers: { authorization: `Basic ${Buffer.from(`${username}:${password}`).toString('base64')}` } }
      : undefined;
  }
  return mapScopedValueCredential(credential, payload);
}

function mapScopedValueCredential(
  credential: CredentialRef,
  payload: SecretPayload,
): EndpointTestCredential | undefined {
  const separator = credential.scope?.indexOf(':') ?? -1;
  if (separator < 1) return undefined;
  const location = credential.scope?.slice(0, separator);
  const name = credential.scope?.slice(separator + 1).trim();
  const value = payload.value ?? payload.token ?? Object.values(payload)[0];
  if (!name || !value) return undefined;
  if (location === 'header') return { headers: { [name]: value } };
  if (location === 'query') return { query: { [name]: value } };
  return undefined;
}
