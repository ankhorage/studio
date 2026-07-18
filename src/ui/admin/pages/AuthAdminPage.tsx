import {
  DEFAULT_AUTH_FLOW,
  type AppManifest,
  type AuthOAuthProviderConfig,
  type AuthOAuthProviderId,
} from '@ankhorage/contracts';
import {
  getSupabaseOAuthProviderDefinition,
  SUPABASE_OAUTH_PROVIDER_IDS,
  type SupabaseOAuthProviderId,
} from '@ankhorage/supabase-auth';
import { Heading, Text, useZoraTheme } from '@ankhorage/zora';
import { useRouter } from 'expo-router';
import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  TextInput,
  View,
} from 'react-native';

import { readStudioAuthSettings, type StudioAuthSettings } from '../../../authSettings';
import type { StudioAdminRouteId } from '../../../index';
import type { ProjectAuthHealth } from '../../../projectAuthHealth';
import {
  getProjectAuthHealth,
  getProjectAuthSettings,
  ProjectAuthApiError,
  saveProjectAuthSettings,
} from '../../../projectAuthApi';
import { configureProjectOAuthProvider } from '../../../projectSecretApi';

const SIGN_IN_IDENTIFIERS = ['email', 'phone', 'username'] as const;
const PROFILE_FIELDS = [
  'email',
  'phone',
  'username',
  'firstName',
  'lastName',
  'displayName',
  'avatarUrl',
] as const;

interface RecoverableOAuthPartialFailure {
  readonly state: 'secret_saved_manifest_failed';
  readonly providerId: SupabaseOAuthProviderId;
  readonly credentialsRef: string;
  readonly configuredFields: readonly string[];
  readonly intendedProvider: AuthOAuthProviderConfig;
}

export interface AuthAdminPageProps {
  readonly projectId: string;
  readonly manifest: AppManifest | null;
  readonly routeId: Extract<
    StudioAdminRouteId,
    'auth' | 'auth-providers' | 'auth-routes' | 'auth-profile'
  >;
}

export function AuthAdminPage(props: AuthAdminPageProps) {
  const { projectId, manifest, routeId } = props;
  const router = useRouter();
  const [draft, setDraft] = useState<StudioAuthSettings>(
    () => readStudioAuthSettings(manifest ?? createFallbackManifest()) ?? createDefaultSettings(),
  );
  const [health, setHealth] = useState<ProjectAuthHealth | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [partialFailure, setPartialFailure] = useState<RecoverableOAuthPartialFailure | null>(null);

  const reload = useCallback(async () => {
    setLoading(true);
    try {
      const [loaded, loadedHealth] = await Promise.all([
        getProjectAuthSettings(projectId),
        getProjectAuthHealth({ projectId, environment: 'local' }),
      ]);
      setDraft(loaded ?? createDefaultSettings());
      setHealth(loadedHealth);
      setPartialFailure(null);
      setMessage(null);
    } catch (error) {
      const local = manifest ? readStudioAuthSettings(manifest) : null;
      if (local) setDraft(local);
      setMessage(toMessage(error));
    } finally {
      setLoading(false);
    }
  }, [manifest, projectId]);

  useEffect(() => {
    void reload();
  }, [reload]);

  const refreshHealth = useCallback(async () => {
    try {
      setHealth(await getProjectAuthHealth({ projectId, environment: 'local' }));
    } catch (error) {
      setMessage(toMessage(error));
    }
  }, [projectId]);

  const save = useCallback(async () => {
    setSaving(true);
    setMessage(null);
    try {
      const saved = await saveProjectAuthSettings({ projectId, config: draft });
      setDraft(saved);
      setHealth(await getProjectAuthHealth({ projectId, environment: 'local' }));
      setPartialFailure(null);
      setMessage('Authentication configuration saved to the Studio manifest draft.');
    } catch (error) {
      setMessage(toMessage(error));
    } finally {
      setSaving(false);
    }
  }, [draft, projectId]);

  const retryPartialFailure = useCallback(async () => {
    if (!partialFailure) return;

    setSaving(true);
    setMessage(null);
    try {
      const persisted = (await getProjectAuthSettings(projectId)) ?? createDefaultSettings();
      const persistedOAuth = persisted.oauth ?? createDefaultOAuth();
      await saveProjectAuthSettings({
        projectId,
        config: {
          ...persisted,
          oauth: {
            ...persistedOAuth,
            providers: upsertProvider(persistedOAuth.providers, partialFailure.intendedProvider),
          },
        },
      });
      setDraft((current) => {
        const currentOAuth = current.oauth ?? createDefaultOAuth();
        return {
          ...current,
          oauth: {
            ...currentOAuth,
            providers: upsertProvider(currentOAuth.providers, partialFailure.intendedProvider),
          },
        };
      });
      await refreshHealth();
      setPartialFailure(null);
      setMessage(`Linked ${partialFailure.credentialsRef} to the provider configuration.`);
    } catch (error) {
      setMessage(toMessage(error));
    } finally {
      setSaving(false);
    }
  }, [partialFailure, projectId, refreshHealth]);

  const authEnabled = draft.scope !== 'none';
  const signUpEnabled = draft.signUp !== undefined;
  const profileEnabled = draft.profile !== undefined;
  const oauth = draft.oauth ?? createDefaultOAuth();
  const showGeneral = routeId === 'auth';
  const showProviders = routeId === 'auth-providers';
  const showRoutes = routeId === 'auth-routes';
  const showProfile = routeId === 'auth-profile';

  return (
    <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
      {loading ? <ActivityIndicator /> : null}

      {showGeneral || showProviders ? <AuthHealthCard health={health} /> : null}

      {showGeneral ? (
        <Card title="Overview">
          <SwitchSetting
            title="Authentication enabled"
            description="Disabling auth keeps the configuration but sets the canonical scope to none."
            value={authEnabled}
            onValueChange={(enabled) =>
              setDraft((current) => ({ ...current, scope: enabled ? 'global' : 'none' }))
            }
          />
          <KeyValue label="Provider" value="Supabase" />
          <KeyValue label="Configuration source" value="infra.auth" />
          <Text color="neutral" emphasis="muted" variant="caption">
            Roles, RBAC, ABAC, registered users, and user passwords are intentionally not managed
            here.
          </Text>
        </Card>
      ) : null}

      {showGeneral ? (
        <Card title="Email and password">
          <Text weight="semiBold">Sign-in identifiers</Text>
          <View style={styles.choiceRow}>
            {SIGN_IN_IDENTIFIERS.map((identifier) => {
              const selected = draft.signIn.identifiers.includes(identifier);
              return (
                <Choice
                  key={identifier}
                  label={identifier}
                  selected={selected}
                  onPress={() =>
                    setDraft((current) => {
                      const identifiers = selected
                        ? current.signIn.identifiers.filter((value) => value !== identifier)
                        : [...current.signIn.identifiers, identifier];
                      if (identifiers.length === 0) return current;
                      return { ...current, signIn: { identifiers } };
                    })
                  }
                />
              );
            })}
          </View>

          <SwitchSetting
            title="Public sign-up enabled"
            description="When disabled, sign-up configuration is removed from the desired state."
            value={signUpEnabled}
            onValueChange={(enabled) =>
              setDraft((current) =>
                enabled
                  ? {
                      ...current,
                      signUp: current.signUp ?? {
                        requiredFields: ['email', 'password'],
                        optionalFields: [],
                        signUpPolicy: 'requireVerification',
                      },
                    }
                  : omitSignUp(current),
              )
            }
          />

          {draft.signUp ? (
            <>
              <Field label="Required sign-up fields (comma-separated)">
                <Input
                  value={draft.signUp.requiredFields.join(', ')}
                  autoCapitalize="none"
                  onChangeText={(value) =>
                    setDraft((current) =>
                      current.signUp
                        ? {
                            ...current,
                            signUp: {
                              ...current.signUp,
                              requiredFields: splitList(value),
                            },
                          }
                        : current,
                    )
                  }
                />
              </Field>
              <Field label="Optional sign-up fields (comma-separated)">
                <Input
                  value={(draft.signUp.optionalFields ?? []).join(', ')}
                  autoCapitalize="none"
                  onChangeText={(value) =>
                    setDraft((current) =>
                      current.signUp
                        ? {
                            ...current,
                            signUp: {
                              ...current.signUp,
                              optionalFields: splitList(value),
                            },
                          }
                        : current,
                    )
                  }
                />
              </Field>
              <SwitchSetting
                title="Email confirmation required"
                description="Uses the canonical requireVerification sign-up policy."
                value={draft.signUp.signUpPolicy === 'requireVerification'}
                onValueChange={(required) =>
                  setDraft((current) =>
                    current.signUp
                      ? {
                          ...current,
                          signUp: {
                            ...current.signUp,
                            signUpPolicy: required ? 'requireVerification' : 'autoSignIn',
                          },
                        }
                      : current,
                  )
                }
              />
            </>
          ) : null}
        </Card>
      ) : null}

      {showRoutes ? (
        <Card title="Routes">
          <RouteField
            label="Sign-in route"
            value={draft.flow.signInRoute}
            onChange={(signInRoute) => updateFlow(setDraft, { signInRoute })}
          />
          <RouteField
            label="Sign-up route"
            value={draft.flow.signUpRoute ?? ''}
            onChange={(signUpRoute) => updateFlow(setDraft, { signUpRoute })}
          />
          <RouteField
            label="Sign-out route"
            value={draft.flow.signOutRoute ?? ''}
            onChange={(signOutRoute) => updateFlow(setDraft, { signOutRoute })}
          />
          <RouteField
            label="Post-sign-in route"
            value={draft.flow.postSignInRoute}
            onChange={(postSignInRoute) => updateFlow(setDraft, { postSignInRoute })}
          />
          <RouteField
            label="Unauthorized route"
            value={draft.flow.unauthorizedRoute ?? ''}
            onChange={(unauthorizedRoute) => updateFlow(setDraft, { unauthorizedRoute })}
          />
          <RouteField
            label="Forgot-password route"
            value={draft.flow.forgotPasswordRoute ?? ''}
            onChange={(forgotPasswordRoute) => updateFlow(setDraft, { forgotPasswordRoute })}
          />
          <Field label="OAuth callback route">
            <Input
              value={oauth.callbackRoute}
              autoCapitalize="none"
              onChangeText={(callbackRoute) =>
                setDraft((current) => ({
                  ...current,
                  oauth: { ...(current.oauth ?? createDefaultOAuth()), callbackRoute },
                }))
              }
            />
          </Field>
        </Card>
      ) : null}

      {showProviders ? (
        <Card title="OAuth providers">
          <SwitchSetting
            title="OAuth enabled"
            description="Provider credentials remain in the server-side secret store."
            value={oauth.enabled}
            onValueChange={(enabled) =>
              setDraft((current) => ({
                ...current,
                oauth: { ...(current.oauth ?? createDefaultOAuth()), enabled },
              }))
            }
          />
          {SUPABASE_OAUTH_PROVIDER_IDS.map((providerId) => (
            <OAuthProviderSetting
              key={providerId}
              projectId={projectId}
              providerId={providerId}
              oauth={oauth}
              providerHealth={health?.providers.find(
                (provider) => provider.providerId === providerId,
              )}
              onChange={(nextOAuth, nextMessage) => {
                setDraft((current) => ({ ...current, oauth: nextOAuth }));
                setMessage(nextMessage);
              }}
              onSaved={(nextOAuth, nextMessage) => {
                setDraft((current) => ({ ...current, oauth: nextOAuth }));
                setMessage(nextMessage);
                setPartialFailure(null);
                void refreshHealth();
              }}
              onPartialFailure={(failure) => {
                setPartialFailure(failure);
                setMessage(
                  `${failure.credentialsRef} was saved, but the manifest link failed. Retry the link or open project secrets for cleanup.`,
                );
              }}
            />
          ))}

          {partialFailure ? (
            <View style={styles.partialFailure}>
              <Text color="warning" weight="semiBold">
                Credential secret saved, manifest link failed.
              </Text>
              <Text color="neutral" emphasis="muted" variant="caption">
                Ref: {partialFailure.credentialsRef}
              </Text>
              <Text color="neutral" emphasis="muted" variant="caption">
                Configured fields: {partialFailure.configuredFields.join(', ') || 'none'}
              </Text>
              <View style={styles.actions}>
                <SecondaryButton
                  label="Retry manifest link"
                  onPress={() => void retryPartialFailure()}
                />
                <SecondaryButton
                  label="Open cleanup"
                  onPress={() => {
                    router.push('/ankh/secrets');
                  }}
                />
              </View>
            </View>
          ) : null}

          <View style={styles.actions}>
            <SecondaryButton
              label="Open project secrets"
              onPress={() => {
                router.push('/ankh/secrets');
              }}
            />
          </View>
        </Card>
      ) : null}

      {showProfile ? (
        <Card title="Profile">
          <SwitchSetting
            title="Profile table enabled"
            description="Profiles are separate from Supabase Auth users. The users table is not an option."
            value={profileEnabled}
            onValueChange={(enabled) =>
              setDraft((current) =>
                enabled
                  ? {
                      ...current,
                      profile: current.profile ?? {
                        table: 'profiles',
                        fields: ['email', 'displayName', 'avatarUrl'],
                        primaryKey: 'authUserId',
                        createStrategy: 'trigger',
                        updateStrategy: 'api',
                      },
                    }
                  : omitProfile(current),
              )
            }
          />

          {draft.profile ? (
            <>
              <Field label="Profile table">
                <Input
                  value={draft.profile.table ?? 'profiles'}
                  autoCapitalize="none"
                  onChangeText={(table) =>
                    setDraft((current) =>
                      current.profile
                        ? { ...current, profile: { ...current.profile, table } }
                        : current,
                    )
                  }
                />
              </Field>
              <Text weight="semiBold">Profile fields</Text>
              <View style={styles.choiceRow}>
                {PROFILE_FIELDS.map((field) => {
                  const selected = draft.profile?.fields.includes(field) ?? false;
                  return (
                    <Choice
                      key={field}
                      label={field}
                      selected={selected}
                      onPress={() =>
                        setDraft((current) => {
                          if (!current.profile) return current;
                          const fields = selected
                            ? current.profile.fields.filter((value) => value !== field)
                            : [...current.profile.fields, field];
                          return {
                            ...current,
                            profile: { ...current.profile, fields },
                          };
                        })
                      }
                    />
                  );
                })}
              </View>
              <KeyValue label="Primary key" value="authUserId" />
              <Field label="Create strategy">
                <View style={styles.choiceRow}>
                  {(['trigger', 'api', 'app'] as const).map((strategy) => (
                    <Choice
                      key={strategy}
                      label={strategy}
                      selected={draft.profile?.createStrategy === strategy}
                      onPress={() =>
                        setDraft((current) =>
                          current.profile
                            ? {
                                ...current,
                                profile: { ...current.profile, createStrategy: strategy },
                              }
                            : current,
                        )
                      }
                    />
                  ))}
                </View>
              </Field>
              <Field label="Update strategy">
                <View style={styles.choiceRow}>
                  {(['api', 'app'] as const).map((strategy) => (
                    <Choice
                      key={strategy}
                      label={strategy}
                      selected={draft.profile?.updateStrategy === strategy}
                      onPress={() =>
                        setDraft((current) =>
                          current.profile
                            ? {
                                ...current,
                                profile: { ...current.profile, updateStrategy: strategy },
                              }
                            : current,
                        )
                      }
                    />
                  ))}
                </View>
              </Field>
            </>
          ) : null}
        </Card>
      ) : null}

      <View style={styles.footerActions}>
        <SecondaryButton label="Reload" onPress={() => void reload()} />
        <PrimaryButton label="Save authentication" loading={saving} onPress={() => void save()} />
      </View>
      {message ? <Message text={message} /> : null}
    </ScrollView>
  );
}

function OAuthProviderSetting(props: {
  readonly projectId: string;
  readonly providerId: SupabaseOAuthProviderId;
  readonly oauth: NonNullable<StudioAuthSettings['oauth']>;
  readonly providerHealth: ProjectAuthHealth['providers'][number] | undefined;
  readonly onChange: (
    oauth: NonNullable<StudioAuthSettings['oauth']>,
    message: string | null,
  ) => void;
  readonly onSaved: (oauth: NonNullable<StudioAuthSettings['oauth']>, message: string) => void;
  readonly onPartialFailure: (failure: RecoverableOAuthPartialFailure) => void;
}) {
  const definition = getSupabaseOAuthProviderDefinition(props.providerId);
  const current = props.oauth.providers.find((provider) => provider.id === props.providerId);
  const requiredFields =
    props.providerHealth?.requiredFields ??
    definition?.secretFields.map((field) => field.name) ??
    [];
  const configuredFields = props.providerHealth?.configuredFields ?? [];
  const credentialsComplete =
    definition !== null &&
    Boolean(current?.credentialsRef) &&
    requiredFields.length > 0 &&
    requiredFields.every((field) => configuredFields.includes(field));
  const enabled = current?.enabled === true;
  const [credentialValues, setCredentialValues] = useState<Record<string, string>>({});
  const [savingCredentials, setSavingCredentials] = useState(false);
  const [credentialMessage, setCredentialMessage] = useState<string | null>(null);

  const setEnabled = (nextEnabled: boolean) => {
    if (nextEnabled && !credentialsComplete) {
      props.onChange(
        props.oauth,
        `Complete ${definition?.label ?? props.providerId} credentials before enabling the provider.`,
      );
      return;
    }

    const nextProvider = {
      ...(current ?? {
        id: props.providerId,
        label: definition?.label ?? props.providerId,
        scopes: [...(definition?.defaultScopes ?? [])],
      }),
      enabled: nextEnabled,
    };
    props.onChange(
      {
        ...props.oauth,
        providers: upsertProvider(props.oauth.providers, nextProvider),
      },
      null,
    );
  };

  const saveCredentials = async () => {
    if (!definition) {
      setCredentialMessage('The selected OAuth provider is not supported.');
      return;
    }

    const entries = definition.secretFields.map(
      (field) => [field.name, credentialValues[field.name] ?? ''] as const,
    );
    if (entries.some(([, value]) => !value)) {
      setCredentialMessage(
        'Enter a complete credential payload. Existing values cannot be merged.',
      );
      return;
    }

    const credentialsRef = current?.credentialsRef ?? `auth/oauth/${props.providerId}`;
    const intendedProvider = {
      ...(current ?? {
        id: props.providerId,
        label: definition.label,
        scopes: [...definition.defaultScopes],
      }),
      enabled,
      credentialsRef,
    };
    const intendedOAuth = {
      ...props.oauth,
      providers: upsertProvider(props.oauth.providers, intendedProvider),
    };
    setSavingCredentials(true);
    setCredentialMessage(null);
    try {
      const result = await configureProjectOAuthProvider({
        projectId: props.projectId,
        providerId: props.providerId as AuthOAuthProviderId,
        environment: 'local',
        credentialsRef,
        enabled,
        label: current?.label ?? definition.label,
        scopes: current?.scopes ?? definition.defaultScopes,
        payload: Object.freeze(Object.fromEntries(entries) as Record<string, string>),
      });

      if (result.ok) {
        props.onSaved(
          mergeOAuthProviderCredentialsRef(intendedOAuth, intendedProvider, result.credentialsRef),
          `${definition.label} credentials saved through ${result.credentialsRef}.`,
        );
        return;
      }

      if (
        result.state === 'secret_saved_manifest_failed' &&
        result.credentialsRef &&
        result.metadata
      ) {
        props.onPartialFailure({
          state: 'secret_saved_manifest_failed',
          providerId: props.providerId,
          credentialsRef: result.credentialsRef,
          configuredFields: result.metadata.configuredFields,
          intendedProvider: {
            ...intendedProvider,
            credentialsRef: result.credentialsRef,
          },
        });
        return;
      }

      setCredentialMessage(result.error.message);
    } catch (error) {
      setCredentialMessage(toMessage(error));
    } finally {
      setCredentialValues({});
      setSavingCredentials(false);
    }
  };

  return (
    <View style={styles.providerPanel}>
      <View style={styles.providerRow}>
        <View style={styles.grow}>
          <Text weight="semiBold">{definition?.label ?? props.providerId}</Text>
          <Text
            color={credentialsComplete ? 'success' : 'warning'}
            emphasis="muted"
            variant="caption"
          >
            {formatProviderHealthStatus(props.providerHealth?.status ?? 'missing')}
            {current?.credentialsRef ? `: ${current.credentialsRef}` : ''}
          </Text>
          <Text color="neutral" emphasis="muted" variant="caption">
            Required fields: {props.providerHealth?.requiredFields.join(', ') || 'loading'}
          </Text>
        </View>
        <Switch value={enabled} onValueChange={setEnabled} />
      </View>

      {definition?.secretFields.map((field) => (
        <Field key={field.name} label={field.label}>
          <Input
            value={credentialValues[field.name] ?? ''}
            secureTextEntry={field.secret}
            autoCapitalize="none"
            placeholder={credentialsComplete ? 'Enter complete replacement value' : field.label}
            onChangeText={(value) =>
              setCredentialValues((currentValues) => ({
                ...currentValues,
                [field.name]: value,
              }))
            }
          />
        </Field>
      ))}

      <View style={styles.actions}>
        <PrimaryButton
          label={credentialsComplete ? 'Replace credentials' : 'Save credentials'}
          loading={savingCredentials}
          onPress={() => void saveCredentials()}
        />
      </View>
      {credentialMessage ? <Message text={credentialMessage} /> : null}
    </View>
  );
}

function mergeOAuthProviderCredentialsRef(
  oauth: NonNullable<StudioAuthSettings['oauth']>,
  provider: AuthOAuthProviderConfig,
  credentialsRef: string,
): NonNullable<StudioAuthSettings['oauth']> {
  return {
    ...oauth,
    providers: upsertProvider(oauth.providers, {
      ...provider,
      credentialsRef,
    }),
  };
}

function upsertProvider(
  providers: NonNullable<StudioAuthSettings['oauth']>['providers'],
  provider: NonNullable<StudioAuthSettings['oauth']>['providers'][number],
) {
  const index = providers.findIndex((candidate) => candidate.id === provider.id);
  if (index < 0) return [...providers, provider];
  return providers.map((candidate, candidateIndex) =>
    candidateIndex === index ? provider : candidate,
  );
}

function updateFlow(
  setDraft: React.Dispatch<React.SetStateAction<StudioAuthSettings>>,
  patch: Partial<StudioAuthSettings['flow']>,
) {
  setDraft((current) => ({ ...current, flow: { ...current.flow, ...patch } }));
}

function omitSignUp(settings: StudioAuthSettings): StudioAuthSettings {
  const { signUp: _signUp, ...rest } = settings;
  return rest;
}

function omitProfile(settings: StudioAuthSettings): StudioAuthSettings {
  const { profile: _profile, ...rest } = settings;
  return rest;
}

function createDefaultSettings(): StudioAuthSettings {
  return {
    scope: 'none',
    provider: 'supabase',
    flow: { ...DEFAULT_AUTH_FLOW },
    signIn: { identifiers: ['email'] },
    oauth: createDefaultOAuth(),
  };
}

function createDefaultOAuth(): NonNullable<StudioAuthSettings['oauth']> {
  return {
    enabled: false,
    callbackRoute: '/auth/callback',
    providers: [],
  };
}

function createFallbackManifest(): AppManifest {
  return {
    metadata: { name: 'App', slug: 'app', version: '1.0.0', themeId: 'default' },
    settings: { localization: { defaultLocale: 'en', locales: ['en'] } },
    infra: { plugins: [] },
    navigator: { type: 'stack', routes: [] },
    screens: {},
    themes: [],
    activeThemeId: 'default',
  };
}

function splitList(value: string): string[] {
  return [
    ...new Set(
      value
        .split(',')
        .map((entry) => entry.trim())
        .filter(Boolean),
    ),
  ];
}

function toMessage(error: unknown): string {
  if (error instanceof ProjectAuthApiError) return error.message;
  return error instanceof Error ? error.message : 'Authentication configuration request failed.';
}

function AuthHealthCard({ health }: { readonly health: ProjectAuthHealth | null }) {
  if (!health) {
    return (
      <Card title="Health">
        <Text color="neutral" emphasis="muted" variant="bodySmall">
          Auth health is unavailable.
        </Text>
      </Card>
    );
  }

  return (
    <Card title="Health">
      <Text color={healthStatusColor(health.status)} weight="semiBold">
        {formatHealthStatus(health.status)}
      </Text>
      <KeyValue label="Callback route" value={health.callbackUrls.appCallbackRoute} />
      {health.callbackUrls.providerRedirectUrl ? (
        <KeyValue label="Provider redirect URL" value={health.callbackUrls.providerRedirectUrl} />
      ) : null}
      {health.providers.map((provider) => (
        <View key={provider.providerId} style={styles.healthProvider}>
          <Text weight="semiBold">
            {provider.label}: {formatProviderHealthStatus(provider.status)}
          </Text>
          <Text color="neutral" emphasis="muted" variant="caption">
            Ref: {provider.credentialsRef ?? 'none'}
          </Text>
          <Text color="neutral" emphasis="muted" variant="caption">
            Required fields: {provider.requiredFields.join(', ') || 'none'}
          </Text>
          <Text color="neutral" emphasis="muted" variant="caption">
            Configured fields: {provider.configuredFields.join(', ') || 'none'}
          </Text>
          {provider.missingFields.length > 0 ? (
            <Text color="warning" variant="caption">
              Missing fields: {provider.missingFields.join(', ')}
            </Text>
          ) : null}
        </View>
      ))}
      {health.diagnostics.map((diagnostic) => (
        <View key={`${diagnostic.code}:${diagnostic.path ?? ''}`} style={styles.diagnostic}>
          <Text color={diagnosticSeverityColor(diagnostic.severity)} variant="bodySmall">
            {diagnostic.code}
          </Text>
          <Text color="neutral" emphasis="muted" variant="caption">
            {diagnostic.message}
          </Text>
        </View>
      ))}
      {health.diagnostics.length === 0 ? (
        <Text color="success" variant="bodySmall">
          No auth diagnostics.
        </Text>
      ) : null}
    </Card>
  );
}

function formatHealthStatus(status: ProjectAuthHealth['status']): string {
  if (status === 'healthy') return 'Healthy';
  if (status === 'warning') return 'Warning';
  if (status === 'error') return 'Error';
  return 'Not configured';
}

function formatProviderHealthStatus(status: ProjectAuthHealth['providers'][number]['status']) {
  if (status === 'configured') return 'Configured';
  if (status === 'incomplete') return 'Incomplete';
  if (status === 'missing') return 'Missing secret';
  if (status === 'invalid') return 'Invalid';
  return 'Disabled';
}

function healthStatusColor(status: ProjectAuthHealth['status']) {
  if (status === 'healthy') return 'success';
  if (status === 'warning') return 'warning';
  if (status === 'error') return 'danger';
  return 'neutral';
}

function diagnosticSeverityColor(severity: ProjectAuthHealth['diagnostics'][number]['severity']) {
  if (severity === 'error') return 'danger';
  if (severity === 'warning') return 'warning';
  return 'neutral';
}

function Card(props: { readonly title: string; readonly children: React.ReactNode }) {
  const { theme } = useZoraTheme();
  return (
    <View
      style={[
        styles.card,
        { backgroundColor: theme.colors.surface, borderColor: theme.colors.border },
      ]}
    >
      <Heading level={3} text={props.title} />
      {props.children}
    </View>
  );
}

function Field(props: { readonly label: string; readonly children: React.ReactNode }) {
  return (
    <View style={styles.field}>
      <Text variant="bodySmall" weight="semiBold">
        {props.label}
      </Text>
      {props.children}
    </View>
  );
}

function RouteField(props: {
  readonly label: string;
  readonly value: string;
  readonly onChange: (value: string) => void;
}) {
  return (
    <Field label={props.label}>
      <Input value={props.value} autoCapitalize="none" onChangeText={props.onChange} />
    </Field>
  );
}

function Input(props: React.ComponentProps<typeof TextInput>) {
  const { theme } = useZoraTheme();
  return (
    <TextInput
      {...props}
      placeholderTextColor={theme.colors.textMuted}
      style={[
        styles.input,
        {
          color: theme.colors.text,
          backgroundColor: theme.colors.background,
          borderColor: theme.colors.border,
        },
        props.style,
      ]}
    />
  );
}

function SwitchSetting(props: {
  readonly title: string;
  readonly description: string;
  readonly value: boolean;
  readonly onValueChange: (value: boolean) => void;
}) {
  return (
    <View style={styles.switchRow}>
      <View style={styles.grow}>
        <Text weight="semiBold">{props.title}</Text>
        <Text color="neutral" emphasis="muted" variant="caption">
          {props.description}
        </Text>
      </View>
      <Switch value={props.value} onValueChange={props.onValueChange} />
    </View>
  );
}

function Choice(props: {
  readonly label: string;
  readonly selected: boolean;
  readonly onPress: () => void;
}) {
  const { theme } = useZoraTheme();
  return (
    <Pressable
      onPress={props.onPress}
      style={[
        styles.choice,
        {
          borderColor: props.selected ? theme.colors.primary : theme.colors.border,
          backgroundColor: props.selected ? theme.colors.surface : theme.colors.background,
        },
      ]}
    >
      <Text color={props.selected ? 'primary' : 'neutral'} variant="bodySmall" weight="semiBold">
        {props.label}
      </Text>
    </Pressable>
  );
}

function KeyValue(props: { readonly label: string; readonly value: string }) {
  return (
    <View style={styles.keyValue}>
      <Text color="neutral" emphasis="muted" variant="bodySmall">
        {props.label}
      </Text>
      <Text weight="semiBold">{props.value}</Text>
    </View>
  );
}

function PrimaryButton(props: {
  readonly label: string;
  readonly loading: boolean;
  readonly onPress: () => void;
}) {
  const { theme } = useZoraTheme();
  return (
    <Pressable
      disabled={props.loading}
      onPress={props.onPress}
      style={[styles.primaryButton, { backgroundColor: theme.colors.primary }]}
    >
      {props.loading ? (
        <ActivityIndicator color="#ffffff" />
      ) : (
        <Text emphasis="inverse" weight="semiBold">
          {props.label}
        </Text>
      )}
    </Pressable>
  );
}

function SecondaryButton(props: { readonly label: string; readonly onPress: () => void }) {
  const { theme } = useZoraTheme();
  return (
    <Pressable
      onPress={props.onPress}
      style={[styles.secondaryButton, { borderColor: theme.colors.border }]}
    >
      <Text weight="semiBold">{props.label}</Text>
    </Pressable>
  );
}

function Message({ text }: { readonly text: string }) {
  return (
    <Text color="info" variant="bodySmall">
      {text}
    </Text>
  );
}

const styles = StyleSheet.create({
  content: {
    width: '100%',
    maxWidth: 920,
    alignSelf: 'center',
    padding: 20,
    gap: 16,
  },
  card: {
    borderWidth: 1,
    borderRadius: 14,
    padding: 16,
    gap: 14,
  },
  grow: { flex: 1 },
  field: { gap: 6 },
  input: {
    minHeight: 42,
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  switchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
  },
  choiceRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  choice: {
    borderWidth: 1,
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  providerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
    paddingVertical: 8,
  },
  providerPanel: {
    gap: 10,
    paddingVertical: 8,
  },
  partialFailure: {
    gap: 8,
    paddingVertical: 10,
  },
  healthProvider: {
    gap: 3,
    paddingVertical: 8,
  },
  diagnostic: {
    gap: 3,
    paddingVertical: 6,
  },
  keyValue: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 16,
  },
  actions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 10,
  },
  footerActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 10,
  },
  primaryButton: {
    minHeight: 42,
    borderRadius: 8,
    paddingHorizontal: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  secondaryButton: {
    minHeight: 42,
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
