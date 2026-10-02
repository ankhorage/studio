import type { SecretMetadata } from '@ankhorage/contracts/secrets';
import { uniqueSortedStrings } from '@ankhorage/utility/array';
import { toErrorMessage } from '@ankhorage/utility/error';
import { createLatestAsyncCoordinator } from '@ankhorage/utility/scheduling';
import { createCompositeKey, isNonEmptyString } from '@ankhorage/utility/string';
import { Button, Card, Field, IconButton, Text, TextInput, useZoraTheme } from '@ankhorage/zora';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Alert, ScrollView, StyleSheet, View } from 'react-native';

import {
  createProjectSecret,
  getProjectSecretUsages,
  listProjectSecrets,
  ProjectSecretApiError,
  removeProjectSecret,
  replaceProjectSecret,
} from '../../../projectSecretApi';
import type { ProjectSecretUsageSummary } from '../../../projectSecretUsage';
import { useAuthAdminSession } from '../AuthAdminSession';
import {
  clearPendingCredentialLinksForRemovedProjectSecret,
  type AuthAdminWriteResult,
} from './adminAuthSessionModel';

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

/*** Create one blank browser-only secret payload field draft with a monotonically increasing local identity. */
function createField(name = ''): SecretFieldDraft {
  return { id: nextFieldId++, name, value: '' };
}

/***
 * Render project secret creation/rotation, metadata inventory, usage analysis, and guarded deletion without exposing stored secret values.
 * @todo This page owns substantial secrets application orchestration; move lifecycle/use-analysis/delete-confirmation use cases into `secrets/` and replace duplicate generic UI primitives with ZORA.
 */
export function SecretsAdminPage({ projectId }: { readonly projectId: string }) {
  const authAdminSession = useAuthAdminSession();
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
    () => ['All', ...uniqueSortedStrings(inventory.items.map((item) => item.kind))],
    [inventory.items],
  );
  const providerOptions = useMemo(
    () => [
      'All',
      ...uniqueSortedStrings(inventory.items.map((item) => item.provider).filter(isNonEmptyString)),
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

  /*** Reset the create/rotation form to a fresh local secret draft. */
  const resetDraft = useCallback(() => {
    setRef('');
    setKind('api-key');
    setProvider('');
    setFields([createField('value')]);
    setReplaceTarget(null);
  }, []);

  /***
   * Patch one array item selected by an id while preserving all other items; parameterized key/update logic is reusable.
   * @utility @ankhorage/utility/array
   */
  const updateField = useCallback(
    (id: number, patch: Partial<Pick<SecretFieldDraft, 'name' | 'value'>>) => {
      setFields((current) =>
        current.map((field) => (field.id === id ? { ...field, ...patch } : field)),
      );
    },
    [],
  );

  /*** Initialize a complete replacement payload draft from secret metadata without exposing previous secret values. */
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

  /*** Validate and persist either a new secret or a complete replacement, then clear browser-held values and refresh inventory. */
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

  /***
   * Remove one project secret and reconcile pending local OAuth credential-link recovery under the auth cleanup lock when applicable.
   * @todo Move this cross-domain secret/auth cleanup use case out of React UI into the secrets/auth application boundary.
   */
  const removeSecretAndReconcilePendingAuth = useCallback(
    async (metadata: SecretMetadata, confirmBrokenReferences = false) => {
      /*** Remove the physical secret and clear pending local auth links only after successful removal. */
      const removeAndReconcile = async () => {
        await removeProjectSecret({
          projectId,
          environment: metadata.scope.environment,
          ref: metadata.ref,
          ...(confirmBrokenReferences ? { confirmBrokenReferences: true } : {}),
        });
        clearPendingCredentialLinksForRemovedProjectSecret({
          session: authAdminSession,
          environment: metadata.scope.environment,
          ref: metadata.ref,
          removed: true,
        });
      };

      if (metadata.scope.environment === 'local') {
        const result = await authAdminSession.runCredentialSecretCleanup(
          metadata.ref,
          removeAndReconcile,
        );
        if (!result.ok) {
          setMessage(formatSecretCleanupBusyReason(result.reason));
          return false;
        }
      } else {
        await removeAndReconcile();
      }

      await inventory.refresh();
      return true;
    },
    [authAdminSession, inventory, projectId],
  );

  /*** Inspect usages before deletion and either open a broken-reference confirmation flow or request a simple destructive confirmation. */
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
            void removeSecretAndReconcilePendingAuth(metadata)
              .then((removed) => {
                if (removed) setMessage(`Removed ${metadata.ref}.`);
              })
              .catch((error: unknown) => setMessage(toMessage(error)));
          },
        },
      ]);
    },
    [projectId, removeSecretAndReconcilePendingAuth],
  );

  /*** Execute the explicitly confirmed deletion of an in-use secret while intentionally leaving manifest references broken. */
  const confirmBrokenReferenceDelete = useCallback(async () => {
    if (!pendingDelete || pendingDelete.confirmation !== pendingDelete.metadata.ref) {
      return;
    }

    setDeleting(true);
    try {
      const removed = await removeSecretAndReconcilePendingAuth(pendingDelete.metadata, true);
      if (removed) {
        setMessage(`Removed ${pendingDelete.metadata.ref}. Manifest references were not changed.`);
        setPendingDelete(null);
      }
    } catch (error) {
      setMessage(toMessage(error));
    } finally {
      setDeleting(false);
    }
  }, [pendingDelete, removeSecretAndReconcilePendingAuth]);

  return (
    <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
      <Card title={replaceTarget ? 'Rotate secret' : 'Create secret'}>
        <Field label="Environment">
          <TextInput value={environment} onChangeText={setEnvironment} />
        </Field>
        <Field label="Logical reference">
          <TextInput
            value={ref}
            readOnly={replaceTarget !== null}
            autoCapitalize="none"
            placeholder="services/example"
            onChangeText={setRef}
          />
        </Field>
        <View style={styles.columns}>
          <View style={styles.column}>
            <Field label="Kind">
              <TextInput value={kind} readOnly={replaceTarget !== null} onChangeText={setKind} />
            </Field>
          </View>
          <View style={styles.column}>
            <Field label="Provider (optional)">
              <TextInput
                value={provider}
                readOnly={replaceTarget !== null}
                onChangeText={setProvider}
              />
            </Field>
          </View>
        </View>

        <Text weight="semiBold">Complete payload</Text>
        {fields.map((field) => (
          <View key={field.id} style={styles.payloadRow}>
            <View style={styles.payloadName}>
              <TextInput
                value={field.name}
                readOnly={replaceTarget !== null}
                autoCapitalize="none"
                placeholder="fieldName"
                onChangeText={(name) => updateField(field.id, { name })}
              />
            </View>
            <View style={styles.grow}>
              <TextInput
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
            <Button
              variant="outline"
              onPress={() => setFields((current) => [...current, createField()])}
            >
              Add field
            </Button>
          ) : (
            <Button variant="outline" onPress={resetDraft}>
              Cancel rotation
            </Button>
          )}
          <Button loading={saving} onPress={() => void save()}>
            {replaceTarget ? 'Rotate secret' : 'Create secret'}
          </Button>
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
              <TextInput
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
            <TextInput
              value={pendingDelete.confirmation}
              autoCapitalize="none"
              onChangeText={(confirmation) =>
                setPendingDelete((current) => (current ? { ...current, confirmation } : current))
              }
            />
          </Field>
          <View style={styles.actions}>
            <Button variant="outline" onPress={() => setPendingDelete(null)}>
              Cancel
            </Button>
            <Button
              loading={deleting}
              disabled={pendingDelete.confirmation !== pendingDelete.metadata.ref}
              onPress={() => void confirmBrokenReferenceDelete()}
            >
              Delete and leave references
            </Button>
          </View>
        </Card>
      ) : null}
    </ScrollView>
  );
}

/***
 * Load secret metadata inventory for one project/environment while invalidating stale request generations.
 */
function useSecretInventory(projectId: string, environment: string) {
  const [items, setItems] = useState<readonly SecretMetadata[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const coordinator = useMemo(createLatestAsyncCoordinator, []);

  /*** Refresh secret inventory and apply only the latest request generation. */
  const refresh = useCallback(async () => {
    setItems([]);
    setLoading(true);
    setError(null);
    await coordinator.run({
      load: () => listProjectSecrets({ projectId, environment }),
      onValue: (nextItems) => {
        setItems(nextItems);
        setLoading(false);
      },
      onError: (caught) => {
        setItems([]);
        setError(toMessage(caught));
        setLoading(false);
      },
    });
  }, [coordinator, environment, projectId]);

  useEffect(() => {
    void refresh();
    return () => {
      coordinator.invalidate();
    };
  }, [coordinator, refresh]);

  return useMemo(() => ({ items, loading, error, refresh }), [error, items, loading, refresh]);
}

/*** Render one secret metadata inventory row with usage details and rotate/remove actions. */
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
        <Button size="s" variant="outline" onPress={() => setExpanded((current) => !current)}>
          {expanded ? 'Hide usage' : 'Usage'}
        </Button>
        <Button size="s" variant="outline" onPress={props.onRotate}>
          Rotate
        </Button>
        <Button color="danger" size="s" variant="outline" onPress={props.onRemove}>
          Remove
        </Button>
      </View>
    </View>
  );
}

/*** Render a compact selectable list of string-valued filter options. */
function FilterPills(props: {
  readonly options: readonly string[];
  readonly value: string;
  readonly onChange: (value: string) => void;
}) {
  return (
    <View style={styles.filterPills}>
      {props.options.map((option) => (
        <Button
          key={option}
          color={props.value === option ? 'primary' : 'neutral'}
          size="s"
          variant={props.value === option ? 'soft' : 'outline'}
          onPress={() => props.onChange(option)}
        >
          {option}
        </Button>
      ))}
    </View>
  );
}

/*** Render a bordered secret-operation message. */
function Message({ text }: { readonly text: string }) {
  const { theme } = useZoraTheme();
  return (
    <View style={[styles.message, { borderColor: theme.colors.border }]}>
      <Text variant="bodySmall">{text}</Text>
    </View>
  );
}

/***
 * Normalize secret API/general failures to a user-display message with a caller-specific fallback.
 */
function toMessage(error: unknown): string {
  if (error instanceof ProjectSecretApiError || error instanceof Error)
    return toErrorMessage(error);
  return 'The Studio secret operation failed.';
}

/*** Convert an auth/secret cleanup conflict reason into the appropriate administration message. */
function formatSecretCleanupBusyReason(
  reason: Extract<AuthAdminWriteResult<unknown>, { readonly ok: false }>['reason'],
): string {
  if (reason === 'credential_transaction_busy' || reason === 'credential_ref_busy') {
    return 'OAuth credential changes are still being linked for this secret. Try again after they finish.';
  }
  if (reason === 'credential_secret_cleanup_busy') {
    return 'Project secret cleanup is already in progress for this secret.';
  }
  if (reason === 'full_auth_save_busy') {
    return 'Authentication configuration is already being saved.';
  }
  return 'OAuth provider credentials are already being saved.';
}

/***
 * Build a stable composite inventory key from environment and logical secret reference.
 */
function secretInventoryKey(metadata: SecretMetadata): string {
  return createCompositeKey([metadata.scope.environment, metadata.ref], ':');
}

const styles = StyleSheet.create({
  content: {
    width: '100%',
    maxWidth: 1040,
    alignSelf: 'center',
    padding: 20,
    paddingBottom: 48,
    gap: 20,
  },
  columns: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
  column: { flex: 1, minWidth: 220 },
  payloadRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  payloadName: { width: 180 },
  grow: { flex: 1 },
  actions: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'flex-end', gap: 10 },
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
