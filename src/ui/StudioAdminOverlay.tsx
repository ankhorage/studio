import type { AppManifest, AuthOAuthProviderId } from '@ankhorage/contracts';
import type { SecretMetadata } from '@ankhorage/contracts/secrets';
import {
  getSupabaseOAuthProviderDefinition,
  SUPABASE_OAUTH_PROVIDER_IDS,
  type SupabaseOAuthProviderId,
} from '@ankhorage/supabase-auth';
import { Heading, IconButton, Text, useZoraTheme } from '@ankhorage/zora';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import {
  configureProjectOAuthProvider,
  createProjectSecret,
  listProjectSecrets,
  ProjectSecretApiError,
  removeProjectSecret,
  replaceProjectSecret,
} from '../projectSecretApi';

export type StudioPhase2AdminRoute = '/ankh/auth' | '/ankh/secrets';

export interface StudioAdminOverlayProps {
  readonly route: StudioPhase2AdminRoute;
  readonly projectId: string;
  readonly manifest: AppManifest | null;
  readonly onClose: () => void;
}

interface SecretFieldDraft {
  readonly id: number;
  readonly name: string;
  readonly value: string;
}

let nextFieldId = 1;

function createField(name = ''): SecretFieldDraft {
  return { id: nextFieldId++, name, value: '' };
}

export function StudioAdminOverlay(props: StudioAdminOverlayProps) {
  const { route, projectId, manifest, onClose } = props;
  const { theme } = useZoraTheme();
  const authRoute = route === '/ankh/auth';

  return (
    <SafeAreaView
      style={[
        styles.overlay,
        { backgroundColor: theme.colors.background, borderColor: theme.colors.border },
      ]}
    >
      <View style={[styles.header, { borderBottomColor: theme.colors.border }]}>
        <View style={styles.grow}>
          <Heading level={2} text={authRoute ? 'Authentication' : 'Project secrets'} />
          <Text color="neutral" emphasis="muted" variant="bodySmall">
            {authRoute
              ? 'Configure OAuth providers without exposing stored credentials.'
              : 'Create, rotate, and explicitly remove server-side project secrets.'}
          </Text>
        </View>
        <IconButton
          icon={{ name: 'close-outline' }}
          label="Close administration"
          color="neutral"
          variant="ghost"
          onPress={onClose}
        />
      </View>

      {authRoute ? (
        <AuthAdmin projectId={projectId} manifest={manifest} />
      ) : (
        <SecretsAdmin projectId={projectId} />
      )}
    </SafeAreaView>
  );
}

function SecretsAdmin({ projectId }: { readonly projectId: string }) {
  const inventory = useSecretInventory(projectId);
  const [environment, setEnvironment] = useState('local');
  const [ref, setRef] = useState('');
  const [kind, setKind] = useState('api-key');
  const [provider, setProvider] = useState('');
  const [fields, setFields] = useState<SecretFieldDraft[]>([createField('value')]);
  const [replaceTarget, setReplaceTarget] = useState<SecretMetadata | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const resetDraft = useCallback(() => {
    setRef('');
    setKind('api-key');
    setProvider('');
    setFields([createField('value')]);
    setReplaceTarget(null);
  }, []);

  const updateField = useCallback(
    (id: number, patch: Partial<Pick<SecretFieldDraft, 'name' | 'value'>>) => {
      setFields((current) =>
        current.map((field) => (field.id === id ? { ...field, ...patch } : field)),
      );
    },
    [],
  );

  const beginRotation = useCallback((metadata: SecretMetadata) => {
    setReplaceTarget(metadata);
    setEnvironment(metadata.scope.environment);
    setRef(metadata.ref);
    setKind(metadata.kind);
    setProvider(metadata.provider ?? '');
    setFields(
      metadata.configuredFields.length > 0
        ? metadata.configuredFields.map((name) => createField(name))
        : [createField('value')],
    );
    setMessage('Enter every field again. Rotation never merges browser-visible old values.');
  }, []);

  const save = useCallback(async () => {
    const entries = fields.map((field) => [field.name.trim(), field.value] as const);
    if (!ref.trim() || !kind.trim() || entries.some(([name, value]) => !name || !value)) {
      setMessage('Reference, kind, field names, and all values are required.');
      return;
    }

    setSaving(true);
    setMessage(null);
    try {
      const payload = Object.freeze(Object.fromEntries(entries) as Record<string, string>);
      if (replaceTarget) {
        await replaceProjectSecret({
          projectId,
          environment,
          ref: replaceTarget.ref,
          payload,
        });
        setMessage(`Rotated ${replaceTarget.ref}. No stored value was returned.`);
      } else {
        await createProjectSecret({
          projectId,
          environment,
          ref,
          kind,
          provider: provider.trim() || undefined,
          payload,
        });
        setMessage(`Created ${ref.trim()}. Stored values cannot be viewed after save.`);
      }
      await inventory.refresh();
      resetDraft();
    } catch (error) {
      setMessage(toMessage(error));
    } finally {
      setFields((current) => current.map((field) => ({ ...field, value: '' })));
      setSaving(false);
    }
  }, [environment, fields, inventory, kind, projectId, provider, ref, replaceTarget, resetDraft]);

  const confirmRemove = useCallback(
    (metadata: SecretMetadata) => {
      Alert.alert(
        'Remove secret',
        `Remove ${metadata.ref}? Manifest references are not changed automatically.`,
        [
          { text: 'Cancel', style: 'cancel' },
          {
            text: 'Remove',
            style: 'destructive',
            onPress: () => {
              void removeProjectSecret({
                projectId,
                environment: metadata.scope.environment,
                ref: metadata.ref,
              })
                .then(inventory.refresh)
                .then(() => setMessage(`Removed ${metadata.ref}.`))
                .catch((error: unknown) => setMessage(toMessage(error)));
            },
          },
        ],
      );
    },
    [inventory.refresh, projectId],
  );

  return (
    <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
      <Card title={replaceTarget ? 'Rotate secret' : 'Create secret'}>
        <Field label="Environment">
          <Input value={environment} onChangeText={setEnvironment} />
        </Field>
        <Field label="Logical reference">
          <Input
            value={ref}
            editable={!replaceTarget}
            autoCapitalize="none"
            placeholder="services/example"
            onChangeText={setRef}
          />
        </Field>
        <View style={styles.columns}>
          <View style={styles.column}>
            <Field label="Kind">
              <Input value={kind} editable={!replaceTarget} onChangeText={setKind} />
            </Field>
          </View>
          <View style={styles.column}>
            <Field label="Provider (optional)">
              <Input value={provider} editable={!replaceTarget} onChangeText={setProvider} />
            </Field>
          </View>
        </View>

        <Text weight="semiBold">Complete payload</Text>
        {fields.map((field) => (
          <View key={field.id} style={styles.payloadRow}>
            <View style={styles.payloadName}>
              <Input
                value={field.name}
                editable={!replaceTarget}
                autoCapitalize="none"
                placeholder="fieldName"
                onChangeText={(name) => updateField(field.id, { name })}
              />
            </View>
            <View style={styles.grow}>
              <Input
                value={field.value}
                secureTextEntry
                autoCapitalize="none"
                placeholder="New value"
                onChangeText={(value) => updateField(field.id, { value })}
              />
            </View>
            <IconButton
              icon={{ name: 'remove-circle-outline' }}
              label="Remove field"
              color="danger"
              variant="ghost"
              disabled={replaceTarget !== null || fields.length === 1}
              onPress={() =>
                setFields((current) => current.filter((candidate) => candidate.id !== field.id))
              }
            />
          </View>
        ))}

        <View style={styles.actions}>
          {!replaceTarget ? (
            <SecondaryButton
              label="Add field"
              onPress={() => setFields((current) => [...current, createField()])}
            />
          ) : (
            <SecondaryButton label="Cancel rotation" onPress={resetDraft} />
          )}
          <PrimaryButton
            label={replaceTarget ? 'Rotate secret' : 'Create secret'}
            loading={saving}
            onPress={() => void save()}
          />
        </View>
        {message ? <Message text={message} /> : null}
      </Card>

      <Card title="Secret inventory">
        <Text color="neutral" emphasis="muted" variant="bodySmall">
          Only metadata and configured field names are available to the browser.
        </Text>
        {inventory.loading ? <ActivityIndicator /> : null}
        {inventory.error ? <Message text={inventory.error} /> : null}
        {inventory.items.map((metadata) => (
          <InventoryRow
            key={`${metadata.scope.environment}:${metadata.ref}`}
            metadata={metadata}
            onRotate={() => beginRotation(metadata)}
            onRemove={() => confirmRemove(metadata)}
          />
        ))}
        {!inventory.loading && inventory.items.length === 0 ? (
          <Text color="neutral" emphasis="muted">
            No local project secrets configured.
          </Text>
        ) : null}
      </Card>
    </ScrollView>
  );
}

function AuthAdmin(props: { readonly projectId: string; readonly manifest: AppManifest | null }) {
  const { projectId, manifest } = props;
  const inventory = useSecretInventory(projectId);
  const [providerId, setProviderId] = useState<SupabaseOAuthProviderId>('google');
  const [enabled, setEnabled] = useState(true);
  const [label, setLabel] = useState('Google');
  const [scopes, setScopes] = useState('openid, email, profile');
  const [callbackRoute, setCallbackRoute] = useState('/auth/callback');
  const [values, setValues] = useState<Record<string, string>>({});
  const [message, setMessage] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const definition = getSupabaseOAuthProviderDefinition(providerId);
  const providerConfig = manifest?.infra.auth?.oauth?.providers.find(
    (provider) => provider.id === providerId,
  );
  const credentialsRef = providerConfig?.credentialsRef ?? `auth/oauth/${providerId}`;
  const metadata = inventory.items.find((item) => item.ref === credentialsRef);
  const requiredFields = definition?.secretFields.map((field) => field.name) ?? [];
  const configured =
    metadata !== undefined && requiredFields.every((name) => metadata.configuredFields.includes(name));

  useEffect(() => {
    const currentDefinition = getSupabaseOAuthProviderDefinition(providerId);
    const currentConfig = manifest?.infra.auth?.oauth?.providers.find(
      (provider) => provider.id === providerId,
    );
    setEnabled(currentConfig?.enabled ?? true);
    setLabel(currentConfig?.label ?? currentDefinition?.label ?? providerId);
    setScopes((currentConfig?.scopes ?? currentDefinition?.defaultScopes ?? []).join(', '));
    setCallbackRoute(manifest?.infra.auth?.oauth?.callbackRoute ?? '/auth/callback');
    setValues({});
    setMessage(null);
  }, [manifest, providerId]);

  const save = useCallback(async () => {
    if (!definition) {
      setMessage('The selected OAuth provider is not supported.');
      return;
    }

    const entries = definition.secretFields.map(
      (field) => [field.name, values[field.name] ?? ''] as const,
    );
    if (entries.some(([, value]) => !value)) {
      setMessage('Enter a complete credential payload. Existing values cannot be merged.');
      return;
    }

    setSaving(true);
    setMessage(null);
    try {
      const result = await configureProjectOAuthProvider({
        projectId,
        providerId: providerId as AuthOAuthProviderId,
        environment: 'local',
        credentialsRef,
        enabled,
        label,
        scopes: scopes
          .split(',')
          .map((scope) => scope.trim())
          .filter(Boolean),
        callbackRoute,
        payload: Object.freeze(Object.fromEntries(entries) as Record<string, string>),
      });
      setMessage(
        result.ok
          ? `${definition.label} credentials saved through ${result.credentialsRef}.`
          : result.error.message,
      );
      await inventory.refresh();
    } catch (error) {
      setMessage(toMessage(error));
    } finally {
      setValues({});
      setSaving(false);
    }
  }, [
    callbackRoute,
    credentialsRef,
    definition,
    enabled,
    inventory,
    label,
    projectId,
    providerId,
    scopes,
    values,
  ]);

  return (
    <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
      <Card title="Authentication overview">
        <KeyValue label="Provider" value={manifest?.infra.auth?.provider ?? 'Not configured'} />
        <KeyValue
          label="Sign-in identifiers"
          value={(manifest?.infra.auth?.signIn?.identifiers ?? ['email']).join(', ')}
        />
        <KeyValue
          label="Sign-in route"
          value={manifest?.infra.auth?.flow?.signInRoute ?? 'Canonical default'}
        />
        <KeyValue
          label="Profile table"
          value={manifest?.infra.auth?.profile?.table ?? 'Not configured'}
        />
      </Card>

      <Card title="OAuth provider credentials">
        <View style={styles.providerTabs}>
          {SUPABASE_OAUTH_PROVIDER_IDS.map((id) => (
            <ProviderTab
              key={id}
              id={id}
              selected={id === providerId}
              configured={inventory.items.some((item) => item.ref === `auth/oauth/${id}`)}
              onPress={() => setProviderId(id)}
            />
          ))}
        </View>

        <View style={styles.switchRow}>
          <View style={styles.grow}>
            <Text weight="semiBold">Enable {definition?.label ?? providerId}</Text>
            <Text color="neutral" emphasis="muted" variant="caption">
              Disabling does not delete the stored secret.
            </Text>
          </View>
          <Switch value={enabled} onValueChange={setEnabled} />
        </View>

        <Field label="Label">
          <Input value={label} onChangeText={setLabel} />
        </Field>
        <Field label="Callback route">
          <Input value={callbackRoute} autoCapitalize="none" onChangeText={setCallbackRoute} />
        </Field>
        <Field label="Scopes (comma-separated)">
          <Input value={scopes} autoCapitalize="none" onChangeText={setScopes} />
        </Field>

        <Text color={configured ? 'success' : 'warning'} variant="bodySmall">
          {configured
            ? `Configured fields: ${metadata?.configuredFields.join(', ')}`
            : `Required fields: ${requiredFields.join(', ')}`}
        </Text>
        <Text color="neutral" emphasis="muted" variant="caption">
          Existing values are never loaded. Saving always performs a complete replacement.
        </Text>

        {definition?.secretFields.map((field) => (
          <Field key={field.name} label={field.label}>
            <Input
              value={values[field.name] ?? ''}
              secureTextEntry={field.secret}
              autoCapitalize="none"
              placeholder={configured ? 'Enter complete replacement value' : field.label}
              onChangeText={(value) => setValues((current) => ({ ...current, [field.name]: value }))}
            />
          </Field>
        ))}

        <View style={styles.actions}>
          <PrimaryButton
            label={configured ? 'Replace credentials' : 'Save provider'}
            loading={saving}
            onPress={() => void save()}
          />
        </View>
        {inventory.error ? <Message text={inventory.error} /> : null}
        {message ? <Message text={message} /> : null}
      </Card>
    </ScrollView>
  );
}

function useSecretInventory(projectId: string) {
  const [items, setItems] = useState<readonly SecretMetadata[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      setItems(await listProjectSecrets({ projectId, environment: 'local' }));
      setError(null);
    } catch (caught) {
      setError(toMessage(caught));
    } finally {
      setLoading(false);
    }
  }, [projectId]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  return useMemo(() => ({ items, loading, error, refresh }), [error, items, loading, refresh]);
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

function InventoryRow(props: {
  readonly metadata: SecretMetadata;
  readonly onRotate: () => void;
  readonly onRemove: () => void;
}) {
  const { theme } = useZoraTheme();
  const { metadata } = props;
  return (
    <View style={[styles.inventoryRow, { borderColor: theme.colors.border }]}>
      <View style={styles.grow}>
        <Text weight="semiBold">{metadata.ref}</Text>
        <Text color="neutral" emphasis="muted" variant="caption">
          {metadata.scope.environment} · {metadata.kind}
          {metadata.provider ? ` · ${metadata.provider}` : ''}
        </Text>
        <Text color="neutral" emphasis="muted" variant="caption">
          Fields: {metadata.configuredFields.join(', ') || 'none'}
        </Text>
      </View>
      <View style={styles.rowActions}>
        <SecondaryButton label="Rotate" compact onPress={props.onRotate} />
        <SecondaryButton label="Remove" compact danger onPress={props.onRemove} />
      </View>
    </View>
  );
}

function ProviderTab(props: {
  readonly id: SupabaseOAuthProviderId;
  readonly selected: boolean;
  readonly configured: boolean;
  readonly onPress: () => void;
}) {
  const { theme } = useZoraTheme();
  const definition = getSupabaseOAuthProviderDefinition(props.id);
  return (
    <Pressable
      onPress={props.onPress}
      style={[
        styles.providerTab,
        { borderColor: props.selected ? theme.colors.primary : theme.colors.border },
      ]}
    >
      <Text weight="semiBold">{definition?.label ?? props.id}</Text>
      <Text color={props.configured ? 'success' : 'neutral'} emphasis="muted" variant="caption">
        {props.configured ? 'Configured' : 'Not configured'}
      </Text>
    </Pressable>
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

function SecondaryButton(props: {
  readonly label: string;
  readonly compact?: boolean;
  readonly danger?: boolean;
  readonly onPress: () => void;
}) {
  const { theme } = useZoraTheme();
  return (
    <Pressable
      onPress={props.onPress}
      style={[
        styles.secondaryButton,
        props.compact ? styles.compactButton : null,
        { borderColor: theme.colors.border },
      ]}
    >
      <Text color={props.danger ? 'danger' : 'neutral'} variant="bodySmall" weight="semiBold">
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
      <Text align="right" variant="bodySmall" weight="semiBold">
        {props.value}
      </Text>
    </View>
  );
}

function Message({ text }: { readonly text: string }) {
  const { theme } = useZoraTheme();
  return (
    <View style={[styles.message, { borderColor: theme.colors.border }]}>
      <Text variant="bodySmall">{text}</Text>
    </View>
  );
}

function toMessage(error: unknown): string {
  if (error instanceof ProjectSecretApiError || error instanceof Error) return error.message;
  return 'The Studio secret operation failed.';
}

const styles = StyleSheet.create({
  overlay: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 1000,
    elevation: 24,
    borderWidth: 1,
  },
  header: {
    minHeight: 76,
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderBottomWidth: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
  },
  content: {
    width: '100%',
    maxWidth: 1040,
    alignSelf: 'center',
    padding: 20,
    paddingBottom: 48,
    gap: 20,
  },
  card: {
    borderWidth: 1,
    borderRadius: 14,
    padding: 18,
    gap: 14,
  },
  field: { gap: 6 },
  input: {
    minHeight: 44,
    borderWidth: 1,
    borderRadius: 9,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  columns: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
  column: { flex: 1, minWidth: 220 },
  payloadRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  payloadName: { width: 180 },
  grow: { flex: 1 },
  actions: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'flex-end', gap: 10 },
  primaryButton: {
    minHeight: 42,
    minWidth: 140,
    borderRadius: 9,
    paddingHorizontal: 16,
    paddingVertical: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  secondaryButton: {
    minHeight: 42,
    borderWidth: 1,
    borderRadius: 9,
    paddingHorizontal: 14,
    paddingVertical: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  compactButton: { minHeight: 34, paddingHorizontal: 10, paddingVertical: 6 },
  message: { borderWidth: 1, borderRadius: 9, padding: 12 },
  inventoryRow: {
    borderWidth: 1,
    borderRadius: 10,
    padding: 12,
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: 12,
  },
  rowActions: { flexDirection: 'row', gap: 8 },
  providerTabs: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  providerTab: { minWidth: 150, borderWidth: 1, borderRadius: 10, padding: 12, gap: 3 },
  switchRow: { flexDirection: 'row', alignItems: 'center', gap: 16 },
  keyValue: { flexDirection: 'row', justifyContent: 'space-between', gap: 16 },
});
