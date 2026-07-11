import { DEFAULT_AUTH_FLOW, type AppManifest } from '@ankhorage/contracts';
import {
  getSupabaseOAuthProviderDefinition,
  SUPABASE_OAUTH_PROVIDER_IDS,
  type SupabaseOAuthProviderId,
} from '@ankhorage/supabase-auth';
import { Heading, IconButton, Text, useZoraTheme } from '@ankhorage/zora';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import {
  readStudioAuthSettings,
  type StudioAuthSettings,
} from '../authSettings';
import {
  getProjectAuthSettings,
  ProjectAuthApiError,
  saveProjectAuthSettings,
} from '../projectAuthApi';
import { StudioAdminOverlay } from './StudioAdminOverlay';

export interface StudioAuthSettingsOverlayProps {
  readonly projectId: string;
  readonly manifest: AppManifest | null;
  readonly onClose: () => void;
}

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

export function StudioAuthSettingsOverlay(props: StudioAuthSettingsOverlayProps) {
  const { projectId, manifest, onClose } = props;
  const { theme } = useZoraTheme();
  const [draft, setDraft] = useState<StudioAuthSettings>(() =>
    readStudioAuthSettings(manifest ?? createFallbackManifest()) ?? createDefaultSettings(),
  );
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [manageCredentials, setManageCredentials] = useState(false);

  const reload = useCallback(async () => {
    setLoading(true);
    try {
      const loaded = await getProjectAuthSettings(projectId);
      setDraft(loaded ?? createDefaultSettings());
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

  const save = useCallback(async () => {
    setSaving(true);
    setMessage(null);
    try {
      const saved = await saveProjectAuthSettings({ projectId, config: draft });
      setDraft(saved);
      setMessage('Authentication configuration saved to the Studio manifest draft.');
    } catch (error) {
      setMessage(toMessage(error));
    } finally {
      setSaving(false);
    }
  }, [draft, projectId]);

  const closeCredentialManager = useCallback(() => {
    setManageCredentials(false);
    void reload();
  }, [reload]);

  if (manageCredentials) {
    return (
      <StudioAdminOverlay
        route="/ankh/auth"
        projectId={projectId}
        manifest={manifest}
        onClose={closeCredentialManager}
      />
    );
  }

  const authEnabled = draft.scope !== 'none';
  const signUpEnabled = draft.signUp !== undefined;
  const profileEnabled = draft.profile !== undefined;
  const oauth = draft.oauth ?? createDefaultOAuth();

  return (
    <SafeAreaView
      style={[
        styles.overlay,
        { backgroundColor: theme.colors.background, borderColor: theme.colors.border },
      ]}
    >
      <View style={[styles.header, { borderBottomColor: theme.colors.border }]}> 
        <View style={styles.grow}>
          <Heading level={2} text="Authentication" />
          <Text color="neutral" emphasis="muted" variant="bodySmall">
            Configure canonical auth methods, routes, profile settings, and provider activation.
          </Text>
        </View>
        <IconButton
          icon={{ name: 'close-outline' }}
          label="Close authentication settings"
          color="neutral"
          variant="ghost"
          onPress={onClose}
        />
      </View>

      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        {loading ? <ActivityIndicator /> : null}

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
            Roles, RBAC, ABAC, registered users, and user passwords are intentionally not managed here.
          </Text>
        </Card>

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

          <Field label="Forgot-password route">
            <Input
              value={draft.flow.forgotPasswordRoute ?? ''}
              autoCapitalize="none"
              onChangeText={(forgotPasswordRoute) =>
                setDraft((current) => ({
                  ...current,
                  flow: {
                    ...current.flow,
                    ...(forgotPasswordRoute.trim() ? { forgotPasswordRoute } : {}),
                  },
                }))
              }
            />
          </Field>
        </Card>

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
        </Card>

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
          <Field label="Callback route">
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

          {SUPABASE_OAUTH_PROVIDER_IDS.map((providerId) => (
            <OAuthProviderSetting
              key={providerId}
              providerId={providerId}
              oauth={oauth}
              onChange={(nextOAuth, nextMessage) => {
                setDraft((current) => ({ ...current, oauth: nextOAuth }));
                setMessage(nextMessage);
              }}
            />
          ))}

          <View style={styles.actions}>
            <SecondaryButton
              label="Manage OAuth credentials"
              onPress={() => setManageCredentials(true)}
            />
          </View>
        </Card>

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

        <View style={styles.footerActions}>
          <SecondaryButton label="Reload" onPress={() => void reload()} />
          <PrimaryButton label="Save authentication" loading={saving} onPress={() => void save()} />
        </View>
        {message ? <Message text={message} /> : null}
      </ScrollView>
    </SafeAreaView>
  );
}

function OAuthProviderSetting(props: {
  readonly providerId: SupabaseOAuthProviderId;
  readonly oauth: NonNullable<StudioAuthSettings['oauth']>;
  readonly onChange: (
    oauth: NonNullable<StudioAuthSettings['oauth']>,
    message: string | null,
  ) => void;
}) {
  const definition = getSupabaseOAuthProviderDefinition(props.providerId);
  const current = props.oauth.providers.find((provider) => provider.id === props.providerId);
  const configured = Boolean(current?.credentialsRef);
  const enabled = current?.enabled === true;

  const setEnabled = (nextEnabled: boolean) => {
    if (nextEnabled && !current?.credentialsRef) {
      props.onChange(
        props.oauth,
        `Configure ${definition?.label ?? props.providerId} credentials before enabling the provider.`,
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

  return (
    <View style={styles.providerRow}>
      <View style={styles.grow}>
        <Text weight="semiBold">{definition?.label ?? props.providerId}</Text>
        <Text color={configured ? 'success' : 'warning'} emphasis="muted" variant="caption">
          {configured ? `Credentials: ${current?.credentialsRef}` : 'Credentials not configured'}
        </Text>
      </View>
      <Switch value={enabled} onValueChange={setEnabled} />
    </View>
  );
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
  return [...new Set(value.split(',').map((entry) => entry.trim()).filter(Boolean))];
}

function toMessage(error: unknown): string {
  if (error instanceof ProjectAuthApiError) return error.message;
  return error instanceof Error ? error.message : 'Authentication configuration request failed.';
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
  overlay: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 1000,
    borderWidth: 1,
  },
  header: {
    minHeight: 72,
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderBottomWidth: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
  },
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
