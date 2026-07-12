import type { SecretMetadata } from '@ankhorage/contracts/secrets';
import { Heading, IconButton, Text, useZoraTheme } from '@ankhorage/zora';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import {
  createProjectSecret,
  getProjectSecretUsages,
  listProjectSecrets,
  ProjectSecretApiError,
  removeProjectSecret,
  replaceProjectSecret,
} from '../projectSecretApi';
import type { ProjectSecretUsageSummary } from '../projectSecretUsage';

export interface StudioAdminOverlayProps {
  readonly projectId: string;
  readonly onClose: () => void;
}

interface SecretFieldDraft {
  readonly id: number;
  readonly name: string;
  readonly value: string;
}

type UsageLookupState =
  | { readonly status: 'loading' }
  | { readonly status: 'loaded'; readonly summary: ProjectSecretUsageSummary }
  | { readonly status: 'error'; readonly message: string };

let nextFieldId = 1;

function createField(name = ''): SecretFieldDraft {
  return { id: nextFieldId++, name, value: '' };
}

export function StudioAdminOverlay(props: StudioAdminOverlayProps) {
  const { projectId, onClose } = props;
  const { theme } = useZoraTheme();

  return (
    <SafeAreaView
      style={[
        styles.overlay,
        { backgroundColor: theme.colors.background, borderColor: theme.colors.border },
      ]}
    >
      <View style={[styles.header, { borderBottomColor: theme.colors.border }]}>
        <View style={styles.grow}>
          <Heading level={2} text="Project secrets" />
          <Text color="neutral" emphasis="muted" variant="bodySmall">
            Create, rotate, and explicitly remove server-side project secrets.
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

      <SecretsAdmin projectId={projectId} />
    </SafeAreaView>
  );
}

function SecretsAdmin({ projectId }: { readonly projectId: string }) {
  const [inventoryEnvironment, setInventoryEnvironment] = useState('local');
  const inventory = useSecretInventory(projectId, inventoryEnvironment);
  const [environment, setEnvironment] = useState('local');
  const [ref, setRef] = useState('');
  const [kind, setKind] = useState('api-key');
  const [provider, setProvider] = useState('');
  const [kindFilter, setKindFilter] = useState('All');
  const [providerFilter, setProviderFilter] = useState('All');
  const [usageByKey, setUsageByKey] = useState<Record<string, UsageLookupState>>({});
  const [fields, setFields] = useState<SecretFieldDraft[]>([createField('value')]);
  const [replaceTarget, setReplaceTarget] = useState<SecretMetadata | null>(null);
  const [pendingDelete, setPendingDelete] = useState<{
    readonly metadata: SecretMetadata;
    readonly usageSummary: ProjectSecretUsageSummary;
    readonly confirmation: string;
  } | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const kindOptions = useMemo(
    () => ['All', ...uniqueSorted(inventory.items.map((item) => item.kind))],
    [inventory.items],
  );
  const providerOptions = useMemo(
    () => [
      'All',
      ...uniqueSorted(inventory.items.map((item) => item.provider).filter(isPresentString)),
    ],
    [inventory.items],
  );
  const filteredItems = useMemo(
    () =>
      inventory.items.filter(
        (item) =>
          (kindFilter === 'All' || item.kind === kindFilter) &&
          (providerFilter === 'All' || item.provider === providerFilter),
      ),
    [inventory.items, kindFilter, providerFilter],
  );

  useEffect(() => {
    let cancelled = false;
    setUsageByKey(
      Object.fromEntries(
        inventory.items.map((item) => [secretInventoryKey(item), { status: 'loading' }]),
      ),
    );
    void (async () => {
      const entries = await Promise.all(
        inventory.items.map(async (item) => {
          try {
            const summary = await getProjectSecretUsages({
              projectId,
              environment: item.scope.environment,
              ref: item.ref,
            });
            return [secretInventoryKey(item), { status: 'loaded', summary }] as const;
          } catch (error) {
            return [
              secretInventoryKey(item),
              { status: 'error', message: toMessage(error) },
            ] as const;
          }
        }),
      );
      if (!cancelled) {
        setUsageByKey(Object.fromEntries(entries));
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [inventory.items, projectId]);

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
    async (metadata: SecretMetadata) => {
      let usageSummary;
      try {
        usageSummary = await getProjectSecretUsages({
          projectId,
          environment: metadata.scope.environment,
          ref: metadata.ref,
        });
      } catch (error) {
        setMessage(`Secret usage is unavailable. ${toMessage(error)}`);
        return;
      }

      if (usageSummary.usages.length > 0) {
        setPendingDelete({ metadata, usageSummary, confirmation: '' });
        return;
      }

      Alert.alert('Remove secret', `Remove ${metadata.ref}?`, [
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
      ]);
    },
    [inventory.refresh, projectId],
  );

  const confirmBrokenReferenceDelete = useCallback(async () => {
    if (!pendingDelete || pendingDelete.confirmation !== pendingDelete.metadata.ref) {
      return;
    }

    setDeleting(true);
    try {
      await removeProjectSecret({
        projectId,
        environment: pendingDelete.metadata.scope.environment,
        ref: pendingDelete.metadata.ref,
        confirmBrokenReferences: true,
      });
      await inventory.refresh();
      setMessage(`Removed ${pendingDelete.metadata.ref}. Manifest references were not changed.`);
      setPendingDelete(null);
    } catch (error) {
      setMessage(toMessage(error));
    } finally {
      setDeleting(false);
    }
  }, [inventory, pendingDelete, projectId]);

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
        <View style={styles.columns}>
          <View style={styles.column}>
            <Field label="Environment filter">
              <Input
                value={inventoryEnvironment}
                autoCapitalize="none"
                onChangeText={setInventoryEnvironment}
              />
            </Field>
          </View>
          <View style={styles.column}>
            <Text variant="bodySmall" weight="semiBold">
              Kind
            </Text>
            <FilterPills options={kindOptions} value={kindFilter} onChange={setKindFilter} />
          </View>
          <View style={styles.column}>
            <Text variant="bodySmall" weight="semiBold">
              Provider
            </Text>
            <FilterPills
              options={providerOptions}
              value={providerFilter}
              onChange={setProviderFilter}
            />
          </View>
        </View>
        {inventory.loading ? <ActivityIndicator /> : null}
        {inventory.error ? <Message text={inventory.error} /> : null}
        {filteredItems.map((metadata) => (
          <InventoryRow
            key={`${metadata.scope.environment}:${metadata.ref}`}
            metadata={metadata}
            usageState={usageByKey[secretInventoryKey(metadata)]}
            onRotate={() => beginRotation(metadata)}
            onRemove={() => void confirmRemove(metadata)}
          />
        ))}
        {!inventory.loading && inventory.items.length === 0 ? (
          <Text color="neutral" emphasis="muted">
            No project secrets configured for this environment.
          </Text>
        ) : null}
        {!inventory.loading && inventory.items.length > 0 && filteredItems.length === 0 ? (
          <Text color="neutral" emphasis="muted">
            No project secrets match the selected filters.
          </Text>
        ) : null}
      </Card>
      {pendingDelete ? (
        <Card title="Delete in-use secret">
          <Text color="danger" variant="bodySmall" weight="semiBold">
            References will remain and become broken. No manifest cleanup will be performed.
          </Text>
          <Text variant="bodySmall">Logical ref: {pendingDelete.metadata.ref}</Text>
          {pendingDelete.usageSummary.usages.map((usage) => (
            <View key={`${usage.path}:${usage.label}`} style={styles.usageRow}>
              <Text weight="semiBold">{usage.label}</Text>
              <Text color="neutral" emphasis="muted" variant="caption">
                {usage.path}
              </Text>
              <Text color={usage.breaksWhenMissing ? 'danger' : 'neutral'} variant="caption">
                Breaking when missing: {usage.breaksWhenMissing ? 'yes' : 'no'}
              </Text>
            </View>
          ))}
          <Field label="Type the full logical ref to confirm">
            <Input
              value={pendingDelete.confirmation}
              autoCapitalize="none"
              onChangeText={(confirmation) =>
                setPendingDelete((current) => (current ? { ...current, confirmation } : current))
              }
            />
          </Field>
          <View style={styles.actions}>
            <SecondaryButton label="Cancel" onPress={() => setPendingDelete(null)} />
            <PrimaryButton
              label="Delete and leave references"
              loading={deleting}
              disabled={pendingDelete.confirmation !== pendingDelete.metadata.ref}
              onPress={() => void confirmBrokenReferenceDelete()}
            />
          </View>
        </Card>
      ) : null}
    </ScrollView>
  );
}

function useSecretInventory(projectId: string, environment: string) {
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
  readonly usageState: UsageLookupState | undefined;
  readonly onRotate: () => void;
  readonly onRemove: () => void;
}) {
  const { theme } = useZoraTheme();
  const { metadata } = props;
  const [expanded, setExpanded] = useState(false);
  const usageSummary = props.usageState?.status === 'loaded' ? props.usageState.summary : null;
  const usageCount = usageSummary?.usages.length ?? 0;
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
        {props.usageState?.status === 'loaded' ? (
          <Text color={usageCount > 0 ? 'warning' : 'neutral'} emphasis="muted" variant="caption">
            Usage count: {usageCount}
          </Text>
        ) : props.usageState?.status === 'error' ? (
          <Text color="warning" emphasis="muted" variant="caption">
            Usage unavailable: {props.usageState.message}
          </Text>
        ) : (
          <Text color="neutral" emphasis="muted" variant="caption">
            Usage loading
          </Text>
        )}
        <Text color="neutral" emphasis="muted" variant="caption">
          Created: {metadata.createdAt} · Updated: {metadata.updatedAt}
        </Text>
        {props.usageState?.status === 'loaded' ? (
          <Text color={usageCount > 0 ? 'warning' : 'success'} variant="caption">
            {usageCount > 0 ? 'Referenced by project configuration' : 'No detected references'}
          </Text>
        ) : (
          <Text color="warning" variant="caption">
            Reference status unavailable
          </Text>
        )}
        {expanded && usageSummary
          ? usageSummary.usages.map((usage) => (
              <View key={`${usage.path}:${usage.label}`} style={styles.usageRow}>
                <Text weight="semiBold">{usage.label}</Text>
                <Text color="neutral" emphasis="muted" variant="caption">
                  {usage.path}
                </Text>
                <Text color={usage.breaksWhenMissing ? 'danger' : 'neutral'} variant="caption">
                  Breaking when missing: {usage.breaksWhenMissing ? 'yes' : 'no'}
                </Text>
              </View>
            ))
          : null}
      </View>
      <View style={styles.rowActions}>
        <SecondaryButton
          label={expanded ? 'Hide usage' : 'Usage'}
          compact
          onPress={() => setExpanded((current) => !current)}
        />
        <SecondaryButton label="Rotate" compact onPress={props.onRotate} />
        <SecondaryButton label="Remove" compact danger onPress={props.onRemove} />
      </View>
    </View>
  );
}

function PrimaryButton(props: {
  readonly label: string;
  readonly loading: boolean;
  readonly disabled?: boolean;
  readonly onPress: () => void;
}) {
  const { theme } = useZoraTheme();
  return (
    <Pressable
      disabled={props.loading || props.disabled === true}
      onPress={props.onPress}
      style={[
        styles.primaryButton,
        { backgroundColor: theme.colors.primary },
        props.disabled ? styles.disabledButton : null,
      ]}
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

function FilterPills(props: {
  readonly options: readonly string[];
  readonly value: string;
  readonly onChange: (value: string) => void;
}) {
  return (
    <View style={styles.filterPills}>
      {props.options.map((option) => (
        <SecondaryButton
          key={option}
          label={option}
          compact
          selected={props.value === option}
          onPress={() => props.onChange(option)}
        />
      ))}
    </View>
  );
}

function SecondaryButton(props: {
  readonly label: string;
  readonly compact?: boolean;
  readonly danger?: boolean;
  readonly selected?: boolean;
  readonly onPress: () => void;
}) {
  const { theme } = useZoraTheme();
  return (
    <Pressable
      onPress={props.onPress}
      style={[
        styles.secondaryButton,
        props.compact ? styles.compactButton : null,
        {
          borderColor: props.selected ? theme.colors.primary : theme.colors.border,
          backgroundColor: props.selected ? theme.colors.surface : 'transparent',
        },
      ]}
    >
      <Text color={props.danger ? 'danger' : 'neutral'} variant="bodySmall" weight="semiBold">
        {props.label}
      </Text>
    </Pressable>
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

function secretInventoryKey(metadata: SecretMetadata): string {
  return `${metadata.scope.environment}:${metadata.ref}`;
}

function uniqueSorted(values: readonly string[]): string[] {
  return [...new Set(values)].sort((left, right) => left.localeCompare(right));
}

function isPresentString(value: string | undefined): value is string {
  return typeof value === 'string' && value.length > 0;
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
  disabledButton: { opacity: 0.5 },
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
  filterPills: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  usageRow: { gap: 2, paddingVertical: 6 },
});
