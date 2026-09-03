import {
  DEFAULT_AUTH_FLOW,
  type AppManifest,
  type AuthOAuthProviderConfig,
  type AuthOAuthProviderId,
} from '@ankhorage/contracts';
import type {
  AuthOAuthSetupCallbackRequirement,
  AuthOAuthSetupFieldRequirement,
} from '@ankhorage/contracts/auth';
import {
  APP_DEPLOY_ENVIRONMENT_IDS,
  type AppDeployEnvironmentId,
} from '@ankhorage/contracts/deploy';
import {
  getSupabaseOAuthProviderDefinition,
  SUPABASE_OAUTH_PROVIDER_IDS,
  type SupabaseOAuthProviderId,
} from '@ankhorage/supabase-auth';
import { Heading, Text, useZoraTheme } from '@ankhorage/zora';
import { useRouter } from 'expo-router';
import React, { useCallback, useEffect, useRef, useState } from 'react';
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
import { useStudio } from '../../../core/StudioContext';
import type { StudioAdminRouteId } from '../../../index';
import type { ProjectAuthHealth } from '../../../projectAuthHealth';
import { getProjectAuthHealth, ProjectAuthApiError } from '../../../projectAuthApi';
import { resolveProjectOAuthSetupPlan } from '../../../projectOAuthSetup';
import { configureProjectOAuthProvider } from '../../../projectSecretApi';
import { syncProjectRuntime } from '../../../studioRuntimeApi';
import { useAuthAdminSession } from '../AuthAdminSession';
import { AuthHealthRefreshCoordinator } from './adminAuthHealthFlow';
import {
  persistStoredOAuthCredentialLinkAndPatchLocalDraft,
  persistStoredOAuthCredentialLink,
  type StoredOAuthCredentialLink,
  type StoredOAuthCredentialLinkResult,
} from './adminAuthCredentialFlow';
import {
  type AuthAdminWriteResult,
  rebaseAuthDraftOntoCanonicalCredentialRefs,
} from './adminAuthSessionModel';

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

export interface AuthAdminPageProps {
  readonly projectId: string;
  readonly manifest: AppManifest | null;
  readonly routeId: Extract<
    StudioAdminRouteId,
    'auth' | 'auth-providers' | 'auth-routes' | 'auth-profile'
  >;
}

/***
 * Render and coordinate Studio authentication authoring, OAuth credential setup, health, routes, and profile configuration.
 * @todo This page currently owns substantial auth application orchestration and generic UI primitives; move auth persistence/provider transaction policy into `auth/` and use canonical ZORA form/action patterns.
 */
export function AuthAdminPage(props: AuthAdminPageProps) {
  const { projectId, manifest, routeId } = props;
  const studio = useStudio();
  const authAdminSession = useAuthAdminSession();
  const {
    flushManifest,
    manifest: studioManifest,
    mutateAuthSettings,
    updateAuthSettings,
  } = studio;
  const router = useRouter();
  const [draft, setDraft] = useState<StudioAuthSettings>(
    () => readStudioAuthSettings(manifest ?? createFallbackManifest()) ?? createDefaultSettings(),
  );
  const [health, setHealth] = useState<ProjectAuthHealth | null>(null);
  const [environment, setEnvironment] = useState<AppDeployEnvironmentId>('local');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const canonicalManifestRef = useRef<AppManifest | null>(manifest);
  const initializedDraftFromManifestRef = useRef(manifest !== null);
  const healthRefreshCoordinatorRef = useRef(new AuthHealthRefreshCoordinator());

  canonicalManifestRef.current = studioManifest ?? manifest;

  useEffect(() => {
    if (initializedDraftFromManifestRef.current || !manifest) return;
    initializedDraftFromManifestRef.current = true;
    setDraft(readStudioAuthSettings(manifest) ?? createDefaultSettings());
  }, [manifest]);

  /*** Refresh auth health for the selected environment without allowing stale requests to overwrite newer state. */
  const refreshHealth = useCallback(async () => {
    await healthRefreshCoordinatorRef.current.refresh({
      loadHealth: () => getProjectAuthHealth({ projectId, environment }),
      onHealth: setHealth,
      onError: (error) => setMessage(toMessage(error)),
    });
  }, [environment, projectId]);

  /*** Reload canonical auth settings and health together, rebasing the local editor draft only from the latest accepted request. */
  const reload = useCallback(async () => {
    setLoading(true);
    const result = await healthRefreshCoordinatorRef.current.refresh({
      loadHealth: () => getProjectAuthHealth({ projectId, environment }),
      onHealth: (loadedHealth) => {
        const canonicalAuthSettings = canonicalManifestRef.current
          ? readStudioAuthSettings(canonicalManifestRef.current)
          : null;
        setDraft(canonicalAuthSettings ?? createDefaultSettings());
        setHealth(loadedHealth);
        setMessage(null);
      },
      onError: (error) => {
        const canonicalAuthSettings = canonicalManifestRef.current
          ? readStudioAuthSettings(canonicalManifestRef.current)
          : null;
        if (canonicalAuthSettings) setDraft(canonicalAuthSettings);
        setMessage(toMessage(error));
      },
    });
    if (result.applied || result.error) setLoading(false);
  }, [environment, projectId]);

  useEffect(() => {
    void refreshHealth().finally(() => {
      setLoading(false);
    });
  }, [refreshHealth]);

  /***
   * Persist one auth draft after rebasing canonical credential refs, flush the manifest, synchronize runtime state, and refresh health.
   * @todo Move this multi-step auth save use case into the auth application layer.
   */
  const persistAuthDraft = useCallback(
    async (nextDraft: StudioAuthSettings, nextMessage: string) => {
      const canonicalAuthSettings = canonicalManifestRef.current
        ? readStudioAuthSettings(canonicalManifestRef.current)
        : null;
      const rebasedDraft = rebaseAuthDraftOntoCanonicalCredentialRefs({
        draft: nextDraft,
        canonical: canonicalAuthSettings,
      });
      updateAuthSettings(rebasedDraft);
      await flushManifest();
      await syncProjectRuntime(projectId);
      setMessage(nextMessage);
      await refreshHealth();
    },
    [flushManifest, projectId, refreshHealth, updateAuthSettings],
  );

  /*** Persist one stored OAuth credential reference into the manifest and maintain pending-recovery state when manifest persistence fails. */
  const persistCredentialLink = useCallback(
    async (link: StoredOAuthCredentialLink): Promise<StoredOAuthCredentialLinkResult> => {
      const result = await persistStoredOAuthCredentialLink({
        link,
        mutateAuthSettings,
        flushManifest,
        refreshHealth,
        toMessage,
      });
      if (result.ok) {
        authAdminSession.clearPendingCredentialLink(link.providerId);
        setMessage(result.message);
        return result;
      }

      authAdminSession.setPendingCredentialLink(result.pendingLink);
      setMessage(result.message);
      return result;
    },
    [authAdminSession, flushManifest, mutateAuthSettings, refreshHealth],
  );

  /*** Persist a credential link and mirror it into the local draft only after successful manifest linkage. */
  const persistCredentialLinkAndPatchDraft = useCallback(
    async (link: StoredOAuthCredentialLink) =>
      persistStoredOAuthCredentialLinkAndPatchLocalDraft({
        link,
        persistCredentialLink,
        patchDraft: (mutation) => setDraft(mutation),
      }),
    [persistCredentialLink],
  );

  /*** Retry one pending provider credential-link transaction under the auth session's conflict guard. */
  const retryPendingCredentialLink = useCallback(
    async (link: StoredOAuthCredentialLink) => {
      const result = await authAdminSession.runCredentialTransaction(
        link.providerId,
        link.credentialsRef,
        () => persistCredentialLinkAndPatchDraft(link),
      );
      if (!result.ok) {
        setMessage(formatAuthAdminWriteBusyReason(result.reason));
      }
    },
    [authAdminSession, persistCredentialLinkAndPatchDraft],
  );

  /*** Save the complete auth draft through the session's exclusive whole-auth write transaction. */
  const save = useCallback(async () => {
    setSaving(true);
    setMessage(null);
    try {
      const result = await authAdminSession.runFullAuthSave(() =>
        persistAuthDraft(
          draft,
          'Authentication configuration saved and applied to the generated app.',
        ),
      );
      if (!result.ok) setMessage(formatAuthAdminWriteBusyReason(result.reason));
    } catch (error) {
      setMessage(toMessage(error));
    } finally {
      setSaving(false);
    }
  }, [authAdminSession, draft, persistAuthDraft]);

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
      {authAdminSession.pendingCredentialLinks.map((pendingCredentialLink) => (
        <PendingCredentialLinkCard
          key={pendingCredentialLink.providerId}
          link={pendingCredentialLink}
          loading={
            authAdminSession.fullAuthSaveBusy ||
            authAdminSession.busyCredentialProviderIds.has(pendingCredentialLink.providerId)
          }
          onRetry={() => void retryPendingCredentialLink(pendingCredentialLink)}
          onOpenSecrets={() => {
            router.push('/ankh/secrets');
          }}
        />
      ))}

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
          <Text weight="semiBold">Environment</Text>
          <View style={styles.choiceRow}>
            {APP_DEPLOY_ENVIRONMENT_IDS.map((environmentId) => (
              <Choice
                key={environmentId}
                label={environmentId}
                selected={environment === environmentId}
                onPress={() => {
                  setHealth(null);
                  setEnvironment(environmentId);
                }}
              />
            ))}
          </View>
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
              manifest={canonicalManifestRef.current ?? createFallbackManifest()}
              environment={environment}
              oauth={oauth}
              providerHealth={health?.providers.find(
                (provider) => provider.providerId === providerId,
              )}
              onChange={(nextOAuth, nextMessage) => {
                setDraft((current) => ({ ...current, oauth: nextOAuth }));
                setMessage(nextMessage);
              }}
              onSaved={persistCredentialLinkAndPatchDraft}
              runCredentialTransaction={authAdminSession.runCredentialTransaction}
              transactionBusy={
                authAdminSession.fullAuthSaveBusy ||
                authAdminSession.busyCredentialProviderIds.has(providerId)
              }
            />
          ))}

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
        <PrimaryButton
          label="Save authentication"
          loading={saving || authAdminSession.authWriteBusy}
          onPress={() => void save()}
        />
      </View>
      {message ? <Message text={message} /> : null}
    </ScrollView>
  );
}

/*** Render recovery controls for one OAuth credential secret that was stored but not linked into the manifest. */
function PendingCredentialLinkCard(props: {
  readonly link: StoredOAuthCredentialLink;
  readonly loading: boolean;
  readonly onRetry: () => void;
  readonly onOpenSecrets: () => void;
}) {
  return (
    <Card title="Credential link pending">
      <Text color="warning" weight="semiBold">
        {props.link.providerLabel} credentials were saved, but the Studio manifest link still needs
        to be persisted.
      </Text>
      <KeyValue label="Credentials ref" value={props.link.credentialsRef} />
      <View style={styles.actions}>
        <PrimaryButton
          label="Retry manifest link"
          loading={props.loading}
          onPress={props.onRetry}
        />
        <SecondaryButton label="Open project secrets" onPress={props.onOpenSecrets} />
      </View>
    </Card>
  );
}

/***
 * Render one Supabase OAuth provider's setup requirements, credentials, health state, and enablement controls.
 * @todo Provider setup/credential completeness and transaction policy belongs in the auth application domain; this component should render a prepared view model.
 */
function OAuthProviderSetting(props: {
  readonly projectId: string;
  readonly providerId: SupabaseOAuthProviderId;
  readonly manifest: AppManifest;
  readonly environment: AppDeployEnvironmentId;
  readonly oauth: NonNullable<StudioAuthSettings['oauth']>;
  readonly providerHealth: ProjectAuthHealth['providers'][number] | undefined;
  readonly onChange: (
    oauth: NonNullable<StudioAuthSettings['oauth']>,
    message: string | null,
  ) => void;
  readonly onSaved: (link: StoredOAuthCredentialLink) => Promise<StoredOAuthCredentialLinkResult>;
  readonly runCredentialTransaction: <T>(
    providerId: AuthOAuthProviderId,
    credentialsRef: string,
    operation: () => Promise<T>,
  ) => Promise<AuthAdminWriteResult<T>>;
  readonly transactionBusy: boolean;
}) {
  const definition = getSupabaseOAuthProviderDefinition(props.providerId);
  const setupPlan = resolveProjectOAuthSetupPlan({
    manifest: props.manifest,
    provider: props.providerId,
    environment: props.environment,
  });
  const credentialFields =
    setupPlan?.requirements.filter(
      (requirement): requirement is AuthOAuthSetupFieldRequirement =>
        requirement.kind === 'field' && requirement.persistence === 'trustedCredential',
    ) ?? [];
  const callbackRequirements =
    setupPlan?.requirements.filter(
      (requirement): requirement is AuthOAuthSetupCallbackRequirement =>
        requirement.kind === 'callback',
    ) ?? [];
  const current = props.oauth.providers.find((provider) => provider.id === props.providerId);
  const requiredFields =
    props.providerHealth?.requiredFields ??
    credentialFields.filter((field) => field.required).map((field) => field.key);
  const configuredFields = props.providerHealth?.configuredFields ?? [];
  const credentialsComplete =
    setupPlan !== null &&
    Boolean(current?.credentialsRef) &&
    requiredFields.length > 0 &&
    requiredFields.every((field) => configuredFields.includes(field));
  const enabled = current?.enabled === true;
  const [credentialValues, setCredentialValues] = useState<Record<string, string>>({});
  const [savingCredentials, setSavingCredentials] = useState(false);
  const [credentialMessage, setCredentialMessage] = useState<string | null>(null);

  /*** Toggle a provider only when its required credentials are complete, upserting the provider draft when permitted. */
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

  /*** Validate a complete credential replacement, store it through the secret API, and persist its manifest reference under a keyed transaction lock. */
  const saveCredentials = async () => {
    if (props.transactionBusy) {
      setCredentialMessage(
        `${definition?.label ?? props.providerId} credentials are already being saved.`,
      );
      return;
    }

    if (!definition || !setupPlan) {
      setCredentialMessage('The selected OAuth provider setup is not supported.');
      return;
    }

    const entries = credentialFields.map(
      (field) => [field.key, credentialValues[field.key] ?? ''] as const,
    );
    if (entries.some(([, value]) => !value)) {
      setCredentialMessage(
        'Enter a complete credential payload. Existing values cannot be merged.',
      );
      return;
    }

    const credentialsRef = current?.credentialsRef ?? `auth/oauth/${props.providerId}`;
    const transaction = await props.runCredentialTransaction(
      props.providerId,
      credentialsRef,
      async () => {
        setSavingCredentials(true);
        setCredentialMessage(null);
        try {
          const result = await configureProjectOAuthProvider({
            projectId: props.projectId,
            providerId: props.providerId as AuthOAuthProviderId,
            environment: props.environment,
            credentialsRef,
            payload: Object.freeze(Object.fromEntries(entries) as Record<string, string>),
          });

          if (result.ok) {
            const linkResult = await props.onSaved({
              providerId: props.providerId,
              providerLabel: definition.label,
              credentialsRef: result.credentialsRef,
              providerDefaults: {
                label: definition.label,
                scopes: [...definition.defaultScopes],
              },
              successMessage: `${definition.label} credentials saved through ${result.credentialsRef}.`,
            });
            if (!linkResult.ok) setCredentialMessage(linkResult.message);
            return linkResult;
          }

          setCredentialMessage(result.error.message);
          return null;
        } catch (error) {
          setCredentialMessage(toMessage(error));
          return null;
        } finally {
          setCredentialValues({});
          setSavingCredentials(false);
        }
      },
    );

    if (!transaction.ok) {
      setCredentialMessage(formatAuthAdminWriteBusyReason(transaction.reason));
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

      {credentialFields.map((field) => (
        <Field key={field.key} label={field.label}>
          <Input
            value={credentialValues[field.key] ?? ''}
            secureTextEntry={field.sensitivity === 'secret'}
            autoCapitalize="none"
            placeholder={credentialsComplete ? 'Enter complete replacement value' : field.label}
            onChangeText={(value) =>
              setCredentialValues((currentValues) => ({
                ...currentValues,
                [field.key]: value,
              }))
            }
          />
        </Field>
      ))}

      {callbackRequirements.map((requirement) => (
        <Text
          key={`${requirement.role}:${requirement.target ?? 'provider'}`}
          color="neutral"
          emphasis="muted"
          variant="caption"
        >
          {requirement.label}
          {requirement.target ? ` — ${requirement.target}` : ' — provider'}
        </Text>
      ))}

      <View style={styles.actions}>
        <PrimaryButton
          label={credentialsComplete ? 'Replace credentials' : 'Save credentials'}
          loading={savingCredentials || props.transactionBusy}
          onPress={() => void saveCredentials()}
        />
      </View>
      {credentialMessage ? <Message text={credentialMessage} /> : null}
    </View>
  );
}

/***
 * Immutably insert or replace an array item selected by its `id` key.
 * @utility @ankhorage/utility/array
 */
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

/*** Merge a partial auth-flow patch into the current React auth draft. */
function updateFlow(
  setDraft: React.Dispatch<React.SetStateAction<StudioAuthSettings>>,
  patch: Partial<StudioAuthSettings['flow']>,
) {
  setDraft((current) => ({ ...current, flow: { ...current.flow, ...patch } }));
}

/***
 * Return an immutable object copy without its `signUp` property; parameterized key omission is reusable.
 * @utility @ankhorage/utility/object
 */
function omitSignUp(settings: StudioAuthSettings): StudioAuthSettings {
  const { signUp: _signUp, ...rest } = settings;
  return rest;
}

/***
 * Return an immutable object copy without its `profile` property; parameterized key omission is reusable.
 * @utility @ankhorage/utility/object
 */
function omitProfile(settings: StudioAuthSettings): StudioAuthSettings {
  const { profile: _profile, ...rest } = settings;
  return rest;
}

/*** Create Studio's default editable authentication settings shell. */
function createDefaultSettings(): StudioAuthSettings {
  return {
    scope: 'none',
    provider: 'supabase',
    flow: { ...DEFAULT_AUTH_FLOW },
    signIn: { identifiers: ['email'] },
    oauth: createDefaultOAuth(),
  };
}

/*** Create Studio's default OAuth settings shell. */
function createDefaultOAuth(): NonNullable<StudioAuthSettings['oauth']> {
  return {
    enabled: false,
    callbackRoute: '/auth/callback',
    providers: [],
  };
}

/*** Create the minimal fallback manifest needed to initialize auth authoring before a canonical manifest is available. */
function createFallbackManifest(): AppManifest {
  return {
    metadata: {
      name: 'App',
      slug: 'app',
      version: '1.0.0',
      category: 'developer_tools',
      themeId: 'default',
    },
    settings: { localization: { defaultLocale: 'en', locales: ['en'] } },
    infra: { modules: [] },
    navigator: { type: 'stack', routes: [] },
    screens: {},
    themes: [],
    activeThemeId: 'default',
  };
}

/***
 * Split a comma-delimited string into trimmed, non-empty, insertion-order-deduplicated values.
 * @utility @ankhorage/utility/string
 */
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

/***
 * Normalize auth API/general failures to a user-display message with a caller-specific fallback.
 * @utility @ankhorage/utility/error
 */
function toMessage(error: unknown): string {
  if (error instanceof ProjectAuthApiError) return error.message;
  return error instanceof Error ? error.message : 'Authentication configuration request failed.';
}

/*** Convert an auth write-conflict reason into the administration message appropriate to the blocked operation. */
function formatAuthAdminWriteBusyReason(
  reason: Extract<AuthAdminWriteResult<unknown>, { readonly ok: false }>['reason'],
): string {
  if (reason === 'full_auth_save_busy') {
    return 'Authentication configuration is already being saved.';
  }
  if (reason === 'credential_transaction_busy') {
    return 'OAuth credential changes are still being linked. Try again after they finish.';
  }
  if (reason === 'credential_ref_busy') {
    return 'OAuth credentials for this secret are already being linked.';
  }
  if (reason === 'credential_secret_cleanup_busy') {
    return 'Project secret cleanup is in progress for these OAuth credentials.';
  }
  return 'OAuth provider credentials are already being saved.';
}

/*** Render project auth health, provider field completeness, callback metadata, and diagnostics. */
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
      <KeyValue label="Environment" value={health.setup.environment} />
      <KeyValue label="Enabled targets" value={health.setup.targets.join(', ') || 'none'} />
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

/*** Format the aggregate auth health status for display. */
function formatHealthStatus(status: ProjectAuthHealth['status']): string {
  if (status === 'healthy') return 'Healthy';
  if (status === 'warning') return 'Warning';
  if (status === 'error') return 'Error';
  return 'Not configured';
}

/*** Format one OAuth provider health status for display. */
function formatProviderHealthStatus(status: ProjectAuthHealth['providers'][number]['status']) {
  if (status === 'configured') return 'Configured';
  if (status === 'incomplete') return 'Incomplete';
  if (status === 'missing') return 'Missing secret';
  if (status === 'invalid') return 'Invalid';
  return 'Disabled';
}

/*** Map aggregate auth health status to the semantic text color used by the admin UI. */
function healthStatusColor(status: ProjectAuthHealth['status']) {
  if (status === 'healthy') return 'success';
  if (status === 'warning') return 'warning';
  if (status === 'error') return 'danger';
  return 'neutral';
}

/*** Map auth diagnostic severity to the semantic text color used by the admin UI. */
function diagnosticSeverityColor(severity: ProjectAuthHealth['diagnostics'][number]['severity']) {
  if (severity === 'error') return 'danger';
  if (severity === 'warning') return 'warning';
  return 'neutral';
}

/***
 * Render a themed generic card shell used throughout this auth page.
 * @todo Replace with the canonical ZORA Card instead of owning a duplicate local primitive.
 */
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

/***
 * Render a labeled generic field shell used by auth forms.
 * @todo Replace with the canonical ZORA FormField pattern.
 */
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

/*** Render one route text field using the auth page's local field/input primitives. */
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

/***
 * Render a theme-aware generic React Native text input.
 * @todo Replace with canonical ZORA Input rather than duplicating design-system input ownership in Studio.
 */
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

/***
 * Render a generic title/description/switch setting row.
 * @todo Replace with canonical ZORA SwitchField where its contract fits.
 */
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

/*** Render one selectable pill-like option used by auth/profile configuration. */
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

/***
 * Render a generic label/value row used in auth administration.
 * @todo Reuse the shared admin/ZORA key-value pattern rather than a second local implementation.
 */
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

/***
 * Render the auth page's primary loading/action button.
 * @todo Replace with canonical ZORA Button.
 */
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

/***
 * Render the auth page's secondary action button.
 * @todo Replace with canonical ZORA Button.
 */
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

/*** Render a simple informational auth-admin message. */
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