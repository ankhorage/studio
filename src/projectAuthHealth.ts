import type { AppManifest, AuthOAuthProviderConfig } from '@ankhorage/contracts';
import type { SecretMetadata } from '@ankhorage/contracts/secrets';
import { getSupabaseOAuthProviderDefinition } from '@ankhorage/supabase-auth';

import { validateStudioAuthSettings } from './authSettings';

export type ProjectAuthHealthStatus = 'healthy' | 'warning' | 'error' | 'unconfigured';

export type ProjectAuthDiagnosticSeverity = 'info' | 'warning' | 'error';

export interface ProjectAuthDiagnostic {
  readonly code: string;
  readonly severity: ProjectAuthDiagnosticSeverity;
  readonly message: string;
  readonly path?: string;
  readonly providerId?: string;
  readonly credentialsRef?: string;
}

export type ProjectOAuthProviderHealthStatus =
  'disabled' | 'configured' | 'incomplete' | 'missing' | 'invalid';

export interface ProjectOAuthProviderHealth {
  readonly providerId: string;
  readonly label: string;
  readonly enabled: boolean;
  readonly credentialsRef?: string;
  readonly status: ProjectOAuthProviderHealthStatus;
  readonly requiredFields: readonly string[];
  readonly configuredFields: readonly string[];
  readonly missingFields: readonly string[];
}

export interface ProjectAuthHealth {
  readonly status: ProjectAuthHealthStatus;
  readonly diagnostics: readonly ProjectAuthDiagnostic[];
  readonly providers: readonly ProjectOAuthProviderHealth[];
  readonly callbackUrls: {
    readonly appCallbackRoute: string;
    readonly providerRedirectUrl?: string;
  };
}

export function analyzeProjectAuthHealth(input: {
  readonly manifest: AppManifest;
  readonly secretMetadata: readonly SecretMetadata[];
  readonly secretStoreAvailable?: boolean;
}): ProjectAuthHealth {
  const diagnostics: ProjectAuthDiagnostic[] = [];
  const { auth } = input.manifest.infra;
  const secretMetadataByRef = new Map(
    input.secretMetadata.map((metadata) => [metadata.ref, metadata]),
  );

  if (input.secretStoreAvailable === false) {
    diagnostics.push({
      code: 'secret_store_unavailable',
      severity: 'error',
      message: 'The local project secret store is unavailable.',
    });
  }

  if (!auth) {
    diagnostics.push({
      code: 'auth_unconfigured',
      severity: 'info',
      message: 'Authentication is not configured for this project.',
      path: 'infra.auth',
    });
    return {
      status: 'unconfigured',
      diagnostics: sortDiagnostics(diagnostics),
      providers: [],
      callbackUrls: { appCallbackRoute: '/auth/callback' },
    };
  }

  const settingsValidation = validateStudioAuthSettings({
    scope: auth.scope,
    provider: auth.provider,
    flow: auth.flow,
    signIn: auth.signIn,
    ...(auth.signUp ? { signUp: auth.signUp } : {}),
    ...(auth.oauth ? { oauth: auth.oauth } : {}),
    ...(auth.profile ? { profile: auth.profile } : {}),
  });
  if (!settingsValidation.ok) {
    diagnostics.push({
      code: resolveAuthValidationCode(settingsValidation.error.message),
      severity: 'error',
      message: settingsValidation.error.message,
      path: 'infra.auth',
    });
  }

  if (!auth.profile) {
    diagnostics.push({
      code: 'profile_not_configured',
      severity: 'warning',
      message: 'Auth profile configuration is not configured.',
      path: 'infra.auth.profile',
    });
  }

  const { oauth } = auth;
  const providers = oauth?.providers ?? [];
  const providerHealth = providers.map((provider, index) =>
    analyzeProviderHealth({
      provider,
      index,
      secretMetadata: provider.credentialsRef
        ? secretMetadataByRef.get(provider.credentialsRef)
        : undefined,
      diagnostics,
    }),
  );

  if (oauth?.enabled && providers.filter((provider) => provider.enabled === true).length === 0) {
    diagnostics.push({
      code: 'oauth_enabled_without_providers',
      severity: 'warning',
      message: 'OAuth is enabled but no OAuth provider is enabled.',
      path: 'infra.auth.oauth.providers',
    });
  }

  addDuplicateDiagnostics(providers, diagnostics);

  const sortedDiagnostics = sortDiagnostics(diagnostics);
  return {
    status: resolveHealthStatus(sortedDiagnostics),
    diagnostics: sortedDiagnostics,
    providers: providerHealth.sort((left, right) =>
      left.providerId.localeCompare(right.providerId),
    ),
    callbackUrls: {
      appCallbackRoute: oauth?.callbackRoute ?? '/auth/callback',
    },
  };
}

function analyzeProviderHealth(input: {
  readonly provider: AuthOAuthProviderConfig;
  readonly index: number;
  readonly secretMetadata: SecretMetadata | undefined;
  readonly diagnostics: ProjectAuthDiagnostic[];
}): ProjectOAuthProviderHealth {
  const { provider, secretMetadata } = input;
  const definition = getSupabaseOAuthProviderDefinition(provider.id);
  const enabled = provider.enabled === true;
  const { credentialsRef } = provider;
  const path = `infra.auth.oauth.providers[${input.index}]`;
  const requiredFields = definition?.secretFields.map((field) => field.name) ?? [];
  const configuredFields = secretMetadata?.configuredFields ?? [];
  const missingFields = requiredFields.filter((field) => !configuredFields.includes(field));

  if (!definition) {
    input.diagnostics.push({
      code: 'invalid_provider',
      severity: 'error',
      message: `OAuth provider "${provider.id}" is not supported.`,
      path,
      providerId: provider.id,
      ...(credentialsRef ? { credentialsRef } : {}),
    });
  }

  if (enabled && !credentialsRef) {
    input.diagnostics.push({
      code: 'provider_enabled_without_credentials_ref',
      severity: 'error',
      message: `Enabled OAuth provider "${provider.id}" does not configure credentialsRef.`,
      path: `${path}.credentialsRef`,
      providerId: provider.id,
    });
  }

  if (credentialsRef && !secretMetadata) {
    input.diagnostics.push({
      code: 'referenced_secret_missing',
      severity: enabled ? 'error' : 'warning',
      message: `OAuth provider "${provider.id}" references missing secret metadata.`,
      path: `${path}.credentialsRef`,
      providerId: provider.id,
      credentialsRef,
    });
  }

  if (secretMetadata && missingFields.length > 0) {
    input.diagnostics.push({
      code: 'provider_secret_incomplete',
      severity: enabled ? 'error' : 'warning',
      message: `OAuth provider "${provider.id}" secret metadata is missing required fields: ${missingFields.join(', ')}.`,
      path: `${path}.credentialsRef`,
      providerId: provider.id,
      ...(credentialsRef ? { credentialsRef } : {}),
    });
  }

  return {
    providerId: provider.id,
    label: provider.label ?? definition?.label ?? provider.id,
    enabled,
    ...(credentialsRef ? { credentialsRef } : {}),
    status: resolveProviderStatus({
      enabled,
      definitionExists: definition !== null,
      credentialsRef,
      secretMetadata,
      missingFields,
    }),
    requiredFields,
    configuredFields: [...configuredFields].sort(),
    missingFields,
  };
}

function resolveProviderStatus(input: {
  readonly enabled: boolean;
  readonly definitionExists: boolean;
  readonly credentialsRef: string | undefined;
  readonly secretMetadata: SecretMetadata | undefined;
  readonly missingFields: readonly string[];
}): ProjectOAuthProviderHealthStatus {
  if (!input.enabled) return 'disabled';
  if (!input.definitionExists || !input.credentialsRef) return 'invalid';
  if (!input.secretMetadata) return 'missing';
  if (input.missingFields.length > 0) return 'incomplete';
  return 'configured';
}

function addDuplicateDiagnostics(
  providers: readonly AuthOAuthProviderConfig[],
  diagnostics: ProjectAuthDiagnostic[],
): void {
  const seenProviderIds = new Set<string>();
  const refsByOwner = new Map<string, string>();

  providers.forEach((provider, index) => {
    const path = `infra.auth.oauth.providers[${index}]`;
    if (seenProviderIds.has(provider.id)) {
      diagnostics.push({
        code: 'duplicate_provider_id',
        severity: 'error',
        message: `OAuth provider "${provider.id}" is configured more than once.`,
        path,
        providerId: provider.id,
      });
    }
    seenProviderIds.add(provider.id);

    if (!provider.credentialsRef) return;
    const existingOwner = refsByOwner.get(provider.credentialsRef);
    if (existingOwner && existingOwner !== provider.id) {
      diagnostics.push({
        code: 'duplicate_incompatible_secret_ref',
        severity: 'error',
        message: `Secret reference "${provider.credentialsRef}" is shared by incompatible providers.`,
        path: `${path}.credentialsRef`,
        providerId: provider.id,
        credentialsRef: provider.credentialsRef,
      });
      return;
    }
    refsByOwner.set(provider.credentialsRef, provider.id);
  });
}

function resolveAuthValidationCode(message: string): string {
  if (message.includes('callback')) return 'invalid_callback_route';
  if (message.includes('configured more than once')) return 'duplicate_provider_id';
  if (message.includes('shared by incompatible providers'))
    return 'duplicate_incompatible_secret_ref';
  if (message.includes('requires credentialsRef'))
    return 'provider_enabled_without_credentials_ref';
  return 'invalid_auth_config';
}

function resolveHealthStatus(
  diagnostics: readonly ProjectAuthDiagnostic[],
): ProjectAuthHealthStatus {
  if (diagnostics.some((diagnostic) => diagnostic.severity === 'error')) return 'error';
  if (diagnostics.some((diagnostic) => diagnostic.severity === 'warning')) return 'warning';
  return 'healthy';
}

function sortDiagnostics(
  diagnostics: readonly ProjectAuthDiagnostic[],
): readonly ProjectAuthDiagnostic[] {
  const severityRank: Record<ProjectAuthDiagnosticSeverity, number> = {
    error: 0,
    warning: 1,
    info: 2,
  };

  return [...diagnostics].sort(
    (left, right) =>
      severityRank[left.severity] - severityRank[right.severity] ||
      left.code.localeCompare(right.code) ||
      (left.path ?? '').localeCompare(right.path ?? '') ||
      (left.providerId ?? '').localeCompare(right.providerId ?? ''),
  );
}
