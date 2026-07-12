from pathlib import Path
import re

ROOT = Path(__file__).resolve().parents[1]


def read(path: str) -> str:
    return (ROOT / path).read_text(encoding='utf-8')


def write(path: str, content: str) -> None:
    target = ROOT / path
    target.parent.mkdir(parents=True, exist_ok=True)
    target.write_text(content, encoding='utf-8')


def replace_once(text: str, old: str, new: str, label: str) -> str:
    count = text.count(old)
    if count != 1:
        raise RuntimeError(f'{label}: expected exactly one match, found {count}')
    return text.replace(old, new, 1)


def replace_regex(text: str, pattern: str, replacement: str, label: str) -> str:
    next_text, count = re.subn(pattern, replacement, text, count=1, flags=re.S)
    if count != 1:
        raise RuntimeError(f'{label}: expected exactly one regex match, found {count}')
    return next_text


# 1. Trusted server boundary: credential writes patch provider config only.
path = 'src/host/secrets/projectSecretService.ts'
text = read(path)

text = replace_once(
    text,
    "export type ProjectSecretRemoveResult =\n",
    """export interface LinkOAuthProviderInput {
  readonly projectId: string;
  readonly environment?: string;
  readonly providerId: AuthOAuthProviderId;
  readonly credentialsRef?: string;
  readonly enabled?: boolean;
  readonly label?: string;
  readonly scopes?: readonly string[];
}

export type LinkOAuthProviderResult =
  | {
      readonly ok: true;
      readonly state: 'linked';
      readonly metadata: SecretMetadata;
      readonly credentialsRef: string;
    }
  | {
      readonly ok: false;
      readonly state: 'link_failed';
      readonly error: { readonly code: string; readonly message: string };
      readonly metadata?: SecretMetadata;
      readonly credentialsRef?: string;
    };

export type ProjectSecretRemoveResult =
""",
    'insert OAuth link service contract',
)

text = replace_once(text, 'enabled: input.enabled ?? true,', 'enabled: input.enabled ?? false,', 'disable provider by default')
text = replace_once(
    text,
    """      },
      authScope: input.authScope,
      oauthEnabled: input.oauthEnabled,
      callbackRoute: input.callbackRoute,
    });
""",
    """      },
    });
""",
    'remove global auth state from credential manifest write',
)

link_method = r'''
  async linkOAuthProvider(input: LinkOAuthProviderInput): Promise<LinkOAuthProviderResult> {
    const definition = getSupabaseOAuthProviderDefinition(input.providerId);
    if (!definition) {
      return {
        ok: false,
        state: 'link_failed',
        error: {
          code: 'invalid_config',
          message: `OAuth provider "${input.providerId}" is not supported by the current Supabase provider registry.`,
        },
      };
    }

    const refResult = normalizeSecretRef(input.credentialsRef ?? `auth/oauth/${definition.id}`);
    if (!refResult.ok) {
      return {
        ok: false,
        state: 'link_failed',
        error: toPublicError(refResult.error),
      };
    }

    const scope = createScope(input.projectId, input.environment);
    const result = await this.withAdapter(input.projectId, async (adapter, manifest) => {
      const metadata = await adapter.getMetadata({ scope, ref: refResult.data });
      if (!metadata.ok) return metadata;

      const requiredFields = definition.secretFields.map((field) => field.name);
      const missingFields = requiredFields.filter(
        (field) => !metadata.data.configuredFields.includes(field),
      );
      if (missingFields.length > 0) {
        return {
          ok: false,
          error: {
            code: 'invalid_config',
            message: `OAuth provider "${definition.id}" secret metadata is missing required fields: ${missingFields.join(', ')}.`,
          },
        };
      }

      const nextManifest = configureManifestOAuthProvider(manifest, {
        provider: {
          id: definition.id,
          label: normalizeOptionalText(input.label) ?? definition.label,
          enabled: input.enabled ?? false,
          scopes: normalizeScopes(input.scopes ?? definition.defaultScopes),
          credentialsRef: refResult.data,
        },
      });

      try {
        await this.projectManager.saveStudioManifest({
          projectId: input.projectId,
          manifest: nextManifest,
        });
      } catch {
        return {
          ok: false,
          error: {
            code: 'manifest_write_failed',
            message: 'The stored OAuth credentials could not be linked to the project manifest.',
          },
        };
      }

      return { ok: true, data: metadata.data };
    });

    if (!result.ok) {
      return {
        ok: false,
        state: 'link_failed',
        error: toPublicError(result.error),
        credentialsRef: refResult.data,
      };
    }

    return {
      ok: true,
      state: 'linked',
      metadata: result.data,
      credentialsRef: refResult.data,
    };
  }

'''
text = replace_once(
    text,
    '  private async readEditableManifest(projectId: string): Promise<AppManifest> {\n',
    link_method + '  private async readEditableManifest(projectId: string): Promise<AppManifest> {\n',
    'insert scoped OAuth link method',
)

new_manifest_helper = r'''export function configureManifestOAuthProvider(
  manifest: AppManifest,
  input: {
    readonly provider: AuthOAuthProviderConfig;
    readonly authScope?: NonNullable<AppManifest['infra']['auth']>['scope'];
    readonly oauthEnabled?: boolean;
    readonly callbackRoute?: string;
  },
): AppManifest {
  const currentAuth = manifest.infra.auth;
  const currentOAuth = currentAuth?.oauth;
  const providers = [...(currentOAuth?.providers ?? [])];
  const existingIndex = providers.findIndex((provider) => provider.id === input.provider.id);

  if (existingIndex >= 0) providers[existingIndex] = input.provider;
  else providers.push(input.provider);

  return {
    ...manifest,
    infra: {
      ...manifest.infra,
      auth: {
        ...(currentAuth ?? {
          provider: 'supabase',
          scope: 'none',
          flow: { ...DEFAULT_AUTH_FLOW },
          signIn: { identifiers: ['email'] },
        }),
        oauth: {
          enabled: currentOAuth?.enabled ?? false,
          callbackRoute: normalizeOptionalText(currentOAuth?.callbackRoute) ?? '/auth/callback',
          providers,
        },
      },
    },
  };
}

function createScope'''
text = replace_regex(
    text,
    r"export function configureManifestOAuthProvider\([\s\S]*?\n}\n\nfunction createScope",
    new_manifest_helper,
    'replace manifest provider patch helper',
)
write(path, text)


# 2. Host routes: add scoped retry endpoint and stop accepting global auth mutations.
path = 'src/host/http/secretRoutes.ts'
text = read(path)

oauth_routes = r'''  fastify.post(
    '/api/projects/:id/auth/oauth/:providerId',
    async (request: FastifyRequest, reply) => {
      const { id, providerId } = request.params as { id: string; providerId: string };
      const body = asRecord(request.body);
      const payload = readSecretPayload(body.payload);
      const enabled = readOptionalBoolean(body.enabled);
      if (!payload || (body.enabled !== undefined && enabled === undefined)) {
        return reply.status(400).send({
          error: {
            code: 'invalid_payload',
            message:
              'OAuth configuration requires a complete non-empty credential payload and a boolean enabled value when provided.',
          },
        });
      }

      const result = await service.configureOAuthProvider({
        projectId: id,
        providerId,
        payload,
        environment: readOptionalString(body.environment),
        credentialsRef: readOptionalString(body.credentialsRef),
        enabled,
        label: readOptionalString(body.label),
        scopes: readStringArray(body.scopes),
      });

      if (!result.ok) {
        const status = result.state === 'secret_saved_manifest_failed' ? 409 : 400;
        return reply.status(status).send(result);
      }

      return result;
    },
  );

  fastify.post(
    '/api/projects/:id/auth/oauth/:providerId/link',
    async (request: FastifyRequest, reply) => {
      const { id, providerId } = request.params as { id: string; providerId: string };
      const body = asRecord(request.body);
      const enabled = readOptionalBoolean(body.enabled);
      if (body.enabled !== undefined && enabled === undefined) {
        return reply.status(400).send({
          ok: false,
          error: {
            code: 'invalid_payload',
            message: 'OAuth provider link retry requires a boolean enabled value when provided.',
          },
        });
      }

      const result = await service.linkOAuthProvider({
        projectId: id,
        providerId,
        environment: readOptionalString(body.environment),
        credentialsRef: readOptionalString(body.credentialsRef),
        enabled,
        label: readOptionalString(body.label),
        scopes: readStringArray(body.scopes),
      });

      if (!result.ok) {
        const status =
          result.error.code === 'manifest_write_failed'
            ? 409
            : resolveErrorStatus(result.error.code);
        return reply.status(status).send(result);
      }

      return result;
    },
  );'''
text = replace_regex(
    text,
    r"  fastify\.post\(\n    '/api/projects/:id/auth/oauth/:providerId',[\s\S]*?\n  \);\n}",
    oauth_routes + '\n}',
    'replace OAuth host routes',
)
text = replace_once(
    text,
    """function readAuthScope(value: unknown): 'global' | 'none' | 'integrated' | undefined {
  return value === 'global' || value === 'none' || value === 'integrated' ? value : undefined;
}

""",
    """function readOptionalBoolean(value: unknown): boolean | undefined {
  return typeof value === 'boolean' ? value : undefined;
}

""",
    'replace unused auth-scope parser',
)
write(path, text)


# 3. Small metadata-only client for the provider-only retry endpoint.
write(
    'src/projectOAuthLinkApi.ts',
    r'''import type { AuthOAuthProviderConfig, AuthOAuthProviderId } from '@ankhorage/contracts';
import type { SecretMetadata } from '@ankhorage/contracts/secrets';

import { ProjectSecretApiError } from './projectSecretApi';
import { findRawSecretResponseKey } from './secretResponseGuard';

interface LinkProjectOAuthProviderInput {
  readonly projectId: string;
  readonly providerId: AuthOAuthProviderId;
  readonly environment?: string;
  readonly provider: AuthOAuthProviderConfig;
}

interface LinkProjectOAuthProviderResponse {
  readonly metadata: SecretMetadata;
  readonly credentialsRef: string;
}

export async function linkProjectOAuthProvider(
  input: LinkProjectOAuthProviderInput,
): Promise<LinkProjectOAuthProviderResponse> {
  const { API_BASE } = await import('./core/constants');
  const response = await fetch(
    `${API_BASE}/projects/${encodeURIComponent(input.projectId)}/auth/oauth/${encodeURIComponent(input.providerId)}/link`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        environment: input.environment,
        credentialsRef: input.provider.credentialsRef,
        enabled: input.provider.enabled,
        label: input.provider.label,
        scopes: input.provider.scopes,
      }),
    },
  );
  const value = await readJson(response);
  rejectRawSecretResponse(value);

  if (!response.ok) throw parseHttpError(value, response.status);

  const record = asRecord(value);
  if (
    record.ok !== true ||
    record.state !== 'linked' ||
    typeof record.credentialsRef !== 'string'
  ) {
    throw invalidResponse('OAuth provider link response was invalid.');
  }

  return {
    metadata: parseSecretMetadata(record.metadata),
    credentialsRef: record.credentialsRef,
  };
}

async function readJson(response: Response): Promise<unknown> {
  try {
    return await response.json();
  } catch {
    throw new ProjectSecretApiError({
      code: 'invalid_response',
      message: 'The Studio host returned a non-JSON OAuth provider link response.',
      status: response.status,
    });
  }
}

function parseHttpError(value: unknown, status: number): ProjectSecretApiError {
  const record = asRecord(value);
  const error = asRecord(record.error);
  return new ProjectSecretApiError({
    code: typeof error.code === 'string' ? error.code : 'request_failed',
    message:
      typeof error.message === 'string'
        ? error.message
        : 'The OAuth provider manifest link request failed.',
    status,
  });
}

function parseSecretMetadata(value: unknown): SecretMetadata {
  const record = asRecord(value);
  const scope = asRecord(record.scope);
  if (
    typeof record.ref !== 'string' ||
    typeof record.kind !== 'string' ||
    !Array.isArray(record.configuredFields) ||
    !record.configuredFields.every((field) => typeof field === 'string') ||
    typeof record.createdAt !== 'string' ||
    typeof record.updatedAt !== 'string' ||
    typeof scope.projectId !== 'string' ||
    typeof scope.environment !== 'string' ||
    (record.provider !== undefined && typeof record.provider !== 'string')
  ) {
    throw invalidResponse('OAuth provider link metadata was invalid.');
  }

  return {
    ref: record.ref,
    kind: record.kind,
    ...(typeof record.provider === 'string' ? { provider: record.provider } : {}),
    configuredFields: [...record.configuredFields],
    createdAt: record.createdAt,
    updatedAt: record.updatedAt,
    scope: {
      projectId: scope.projectId,
      environment: scope.environment,
    },
  };
}

function rejectRawSecretResponse(value: unknown): void {
  const match = findRawSecretResponseKey(value);
  if (match) {
    throw invalidResponse(
      `OAuth provider link response was invalid. Raw secret-shaped response field "${match.key}" was present.`,
    );
  }
}

function asRecord(value: unknown): Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

function invalidResponse(message: string): ProjectSecretApiError {
  return new ProjectSecretApiError({ code: 'invalid_response', message, status: 502 });
}
''',
)


# 4. Auth UI: provider-only recovery, preserving all unrelated local edits.
path = 'src/ui/StudioAuthSettingsOverlay.tsx'
text = read(path)
text = replace_once(
    text,
    "import React, { useCallback, useEffect, useMemo, useState } from 'react';",
    "import React, { useCallback, useEffect, useState } from 'react';",
    'remove unused useMemo import',
)
text = replace_once(
    text,
    "import { configureProjectOAuthProvider } from '../projectSecretApi';",
    "import { linkProjectOAuthProvider } from '../projectOAuthLinkApi';\nimport { configureProjectOAuthProvider } from '../projectSecretApi';",
    'import scoped provider link client',
)
text = replace_once(
    text,
    "  readonly intendedOAuth: NonNullable<StudioAuthSettings['oauth']>;",
    '  readonly intendedProvider: AuthOAuthProviderConfig;',
    'store provider-only recovery state',
)
old_retry = r'''  const retryPartialFailure = useCallback(async () => {
    if (!partialFailure) return;

    setSaving(true);
    setMessage(null);
    try {
      const nextDraft = linkRecoverableOAuthCredentials(draft, partialFailure);
      const saved = await saveProjectAuthSettings({ projectId, config: nextDraft });
      setDraft(saved);
      setHealth(await getProjectAuthHealth({ projectId, environment: 'local' }));
      setPartialFailure(null);
      setMessage(`Linked ${partialFailure.credentialsRef} to the provider configuration.`);
    } catch (error) {
      setMessage(toMessage(error));
    } finally {
      setSaving(false);
    }
  }, [draft, partialFailure, projectId]);'''
new_retry = r'''  const retryPartialFailure = useCallback(async () => {
    if (!partialFailure) return;

    setSaving(true);
    setMessage(null);
    try {
      const linked = await linkProjectOAuthProvider({
        projectId,
        providerId: partialFailure.providerId as AuthOAuthProviderId,
        environment: 'local',
        provider: partialFailure.intendedProvider,
      });
      setDraft((current) => ({
        ...current,
        oauth: mergeOAuthProviderCredentialsRef(
          current.oauth ?? createDefaultOAuth(),
          partialFailure.intendedProvider,
          linked.credentialsRef,
        ),
      }));
      await refreshHealth();
      setPartialFailure(null);
      setMessage(`Linked ${linked.credentialsRef} to the provider configuration.`);
    } catch (error) {
      setMessage(toMessage(error));
    } finally {
      setSaving(false);
    }
  }, [partialFailure, projectId, refreshHealth]);'''
text = replace_once(text, old_retry, new_retry, 'replace whole-draft recovery')
text = replace_once(text, "              authScope={draft.scope}\n", '', 'remove auth scope provider prop')
text = replace_once(
    text,
    "  readonly authScope: StudioAuthSettings['scope'];\n",
    '',
    'remove auth scope component contract',
)
text = replace_once(
    text,
    """        authScope: props.authScope,
        oauthEnabled: props.oauth.enabled,
""",
    '',
    'remove global state from credential request',
)
text = replace_once(
    text,
    "        callbackRoute: props.oauth.callbackRoute,\n",
    '',
    'remove callback mutation from credential request',
)
old_partial = r'''          intendedOAuth: {
            ...intendedOAuth,
            providers: upsertProvider(intendedOAuth.providers, {
              ...intendedProvider,
              credentialsRef: result.credentialsRef,
            }),
          },'''
new_partial = r'''          intendedProvider: {
            ...intendedProvider,
            credentialsRef: result.credentialsRef,
          },'''
text = replace_once(text, old_partial, new_partial, 'store intended provider for recovery')
text = replace_regex(
    text,
    r"\nfunction linkRecoverableOAuthCredentials\([\s\S]*?\n}\n\nfunction updateFlow",
    '\nfunction updateFlow',
    'remove whole-draft recovery helper',
)
write(path, text)


# 5. Secret inventory: fail closed on environment changes and stale responses.
path = 'src/ui/StudioAdminOverlay.tsx'
text = read(path)
text = replace_once(
    text,
    "import React, { useCallback, useEffect, useMemo, useState } from 'react';",
    "import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';",
    'import useRef for request sequencing',
)
old_hook = r'''function useSecretInventory(projectId: string, environment: string) {
  const [items, setItems] = useState<readonly SecretMetadata[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      setItems(await listProjectSecrets({ projectId, environment }));
      setError(null);
    } catch (caught) {
      setItems([]);
      setError(toMessage(caught));
    } finally {
      setLoading(false);
    }
  }, [environment, projectId]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  return useMemo(() => ({ items, loading, error, refresh }), [error, items, loading, refresh]);
}'''
new_hook = r'''function useSecretInventory(projectId: string, environment: string) {
  const [items, setItems] = useState<readonly SecretMetadata[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const requestGeneration = useRef(0);

  const refresh = useCallback(async () => {
    const generation = ++requestGeneration.current;
    setItems([]);
    setLoading(true);
    setError(null);
    try {
      const nextItems = await listProjectSecrets({ projectId, environment });
      if (generation !== requestGeneration.current) return;
      setItems(nextItems);
    } catch (caught) {
      if (generation !== requestGeneration.current) return;
      setItems([]);
      setError(toMessage(caught));
    } finally {
      if (generation === requestGeneration.current) setLoading(false);
    }
  }, [environment, projectId]);

  useEffect(() => {
    void refresh();
    return () => {
      requestGeneration.current += 1;
    };
  }, [refresh]);

  return useMemo(() => ({ items, loading, error, refresh }), [error, items, loading, refresh]);
}'''
text = replace_once(text, old_hook, new_hook, 'sequence inventory requests')
write(path, text)


# 6. Source-level regression tests used by the current test setup.
write(
    'src/ui/StudioAuthSettingsOverlay.test.ts',
    r'''import { expect, test } from 'bun:test';
import { readFileSync } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const source = readFileSync(
  path.join(path.dirname(fileURLToPath(import.meta.url)), 'StudioAuthSettingsOverlay.tsx'),
  'utf8',
);

test('auth settings keeps provider-specific OAuth credential orchestration', () => {
  expect(source).toContain('configureProjectOAuthProvider');
  expect(source).toContain('definition.secretFields.map');
  expect(source).toContain("state: 'secret_saved_manifest_failed'");
  expect(source).toContain('intendedProvider');
  expect(source).toContain('Retry manifest link');
});

test('credential saves preserve unrelated draft edits instead of reloading settings', () => {
  expect(source).toContain('void refreshHealth()');
  expect(source).toContain('mergeOAuthProviderCredentialsRef');
  expect(source).toContain('setDraft((current) => ({ ...current, oauth: nextOAuth }))');
  expect(source).not.toContain('onSaved={(nextMessage)');
});

test('credential writes do not submit global auth or OAuth state', () => {
  expect(source).not.toContain('authScope: props.authScope');
  expect(source).not.toContain('oauthEnabled: props.oauth.enabled');
  expect(source).not.toContain('callbackRoute: props.oauth.callbackRoute');
});

test('partial-failure retry patches only the provider link', () => {
  expect(source).toContain('linkProjectOAuthProvider');
  expect(source).toContain('provider: partialFailure.intendedProvider');
  expect(source).not.toContain('linkRecoverableOAuthCredentials');
});

test('auth provider enablement uses credential completeness instead of status or ref alone', () => {
  expect(source).toContain('const credentialsComplete =');
  expect(source).toContain('Boolean(current?.credentialsRef)');
  expect(source).toContain('requiredFields.every');
  expect(source).not.toContain("props.providerHealth?.status === 'configured'");
});
''',
)

write(
    'src/ui/StudioAdminOverlay.test.ts',
    r'''import { expect, test } from 'bun:test';
import { readFileSync } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const source = readFileSync(
  path.join(path.dirname(fileURLToPath(import.meta.url)), 'StudioAdminOverlay.tsx'),
  'utf8',
);

test('secret inventory exposes an environment filter', () => {
  expect(source).toContain('Environment filter');
  expect(source).toContain('useSecretInventory(projectId, inventoryEnvironment)');
});

test('secret inventory clears rows and rejects stale environment responses', () => {
  expect(source).toContain('const generation = ++requestGeneration.current');
  expect(source).toContain('setItems([]);\n    setLoading(true);');
  expect(source).toContain('generation !== requestGeneration.current');
  expect(source).toContain('requestGeneration.current += 1');
});

test('secret usage lookup failures remain unavailable instead of becoming zero usages', () => {
  expect(source).toContain("status: 'error'");
  expect(source).toContain('Usage unavailable');
  expect(source).toContain('Reference status unavailable');
  expect(source).not.toContain('{ ref: item.ref, usages: [] }');
});
''',
)

print('Applied Phase 2 state-integrity fixes.')
