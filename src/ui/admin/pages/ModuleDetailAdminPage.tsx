import { Button, ButtonGroup, Card, Input, Text } from '@ankhorage/zora';
import { useRouter } from 'expo-router';
import React, { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, StyleSheet, View } from 'react-native';

import { useStudio } from '../../../core/StudioContext';
import type { StudioModuleState } from '../../../moduleAdminContracts';
import {
  getProjectModule,
  installProjectModule,
  StudioModuleApiError,
  uninstallProjectModule,
  updateProjectModuleConfig,
} from '../../../moduleAdminApi';
import {
  createStudioModuleAdminDraft,
  parseStudioModuleAdminDraft,
  type StudioModuleAdminDraft,
} from '../../../moduleAdminModel';
import { AdminHeader, AdminScroll, Field, KeyValue } from '../adminPagePrimitives';
import { ModuleAdminViewHost } from '../ModuleAdminViewHost';
import { getStudioModuleAdminView } from '../moduleAdminViewRegistry';

export function ModuleDetailAdminPage({ moduleId }: { readonly moduleId: string | null }) {
  const studio = useStudio();
  const router = useRouter();
  const [module, setModule] = useState<StudioModuleState | null>(null);
  const [draft, setDraft] = useState<StudioModuleAdminDraft>({});
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [unknown, setUnknown] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const applyLoadedModule = useCallback((loaded: StudioModuleState) => {
    setModule(loaded);
    setDraft(
      loaded.admin
        ? createStudioModuleAdminDraft({ contribution: loaded.admin, config: loaded.config })
        : {},
    );
  }, []);

  const reload = useCallback(async () => {
    if (!moduleId) {
      setUnknown(true);
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      applyLoadedModule(await getProjectModule({ projectId: studio.projectId, moduleId }));
      setUnknown(false);
      setMessage(null);
    } catch (error) {
      setUnknown(error instanceof StudioModuleApiError && error.status === 404);
      setMessage(toMessage(error));
    } finally {
      setLoading(false);
    }
  }, [applyLoadedModule, moduleId, studio.projectId]);

  useEffect(() => {
    void reload();
  }, [reload]);

  const runLifecycle = useCallback(
    async (operation: 'install' | 'uninstall') => {
      if (!moduleId) return;
      setBusy(true);
      setMessage(null);
      try {
        const result =
          operation === 'install'
            ? await installProjectModule({ projectId: studio.projectId, moduleId })
            : await uninstallProjectModule({ projectId: studio.projectId, moduleId });
        if (result.module) applyLoadedModule(result.module);
        setMessage(
          result.pending
            ? 'Removal is pending. Reload the generated app, then finalize it from Modules.'
            : `Module ${operation === 'install' ? 'installed' : 'removed'}.`,
        );
        await studio.refetchManifest();
      } catch (error) {
        setMessage(toMessage(error));
      } finally {
        setBusy(false);
      }
    },
    [applyLoadedModule, moduleId, studio],
  );

  const saveConfig = useCallback(async () => {
    if (!moduleId || !module?.admin) return;
    const parsed = parseStudioModuleAdminDraft({
      contribution: module.admin,
      currentConfig: module.config,
      draft,
    });
    if (!parsed.ok) {
      setMessage(parsed.message);
      return;
    }

    setBusy(true);
    setMessage(null);
    try {
      const result = await updateProjectModuleConfig({
        projectId: studio.projectId,
        moduleId,
        config: parsed.config,
      });
      if (result.module) applyLoadedModule(result.module);
      setMessage('Module configuration saved through the Orchestrator lifecycle.');
      await studio.refetchManifest();
    } catch (error) {
      setMessage(toMessage(error));
    } finally {
      setBusy(false);
    }
  }, [applyLoadedModule, draft, module, moduleId, studio]);

  if (loading) {
    return (
      <AdminScroll>
        <ActivityIndicator accessibilityLabel="Loading module" />
      </AdminScroll>
    );
  }

  if (unknown || !module) {
    return (
      <AdminScroll>
        <AdminHeader
          title="Unknown module"
          description="This module ID is not registered and has no installed lifecycle state."
        />
        {message ? <Text color="danger">{message}</Text> : null}
        <Button variant="outline" onPress={() => router.replace('/ankh/modules')}>
          Back to modules
        </Button>
      </AdminScroll>
    );
  }

  const adminView = getStudioModuleAdminView(module.id);

  return (
    <AdminScroll>
      <AdminHeader title={module.name} description={module.description} />
      {message ? (
        <Text color="neutral" emphasis="muted" variant="bodySmall">
          {message}
        </Text>
      ) : null}
      <Card title="Lifecycle status">
        <View style={styles.statusGrid}>
          <KeyValue label="Module ID" value={module.id} />
          <KeyValue label="Available" value={module.available ? 'yes' : 'no'} />
          <KeyValue label="Installed" value={module.installed ? 'yes' : 'no'} />
          <KeyValue label="Pending removal" value={module.pendingRemoval ? 'yes' : 'no'} />
          <KeyValue
            label="Dependents"
            value={module.dependents.length > 0 ? module.dependents.join(', ') : 'none'}
          />
        </View>
        <ButtonGroup orientation="responsive" align="start">
          {!module.installed && module.available ? (
            <Button loading={busy} onPress={() => void runLifecycle('install')}>
              Install
            </Button>
          ) : null}
          {module.installed && !module.pendingRemoval ? (
            <Button
              color="danger"
              variant="outline"
              loading={busy}
              disabled={module.dependents.length > 0}
              onPress={() => void runLifecycle('uninstall')}
            >
              Uninstall
            </Button>
          ) : null}
        </ButtonGroup>
      </Card>

      {adminView && !module.installed ? (
        <Card
          title={module.admin?.title ?? 'Administration'}
          description={module.admin?.description}
        >
          <Text color="neutral" emphasis="muted">
            Install the module before using its package-owned administration view.
          </Text>
        </Card>
      ) : adminView && module.pendingRemoval ? (
        <Card title="Administration unavailable">
          <Text color="neutral" emphasis="muted">
            This module is pending removal and cannot be administered.
          </Text>
        </Card>
      ) : adminView ? (
        <ModuleAdminViewHost moduleId={module.id} contribution={adminView} />
      ) : !module.admin ? (
        <Card
          title={
            module.adminError
              ? 'Administration contribution error'
              : 'No administration contribution'
          }
        >
          <Text color="neutral" emphasis="muted">
            {module.adminError ??
              'This module is lifecycle-only. It does not provide a fake configuration form.'}
          </Text>
        </Card>
      ) : !module.installed ? (
        <Card title={module.admin.title} description={module.admin.description}>
          <Text color="neutral" emphasis="muted">
            Install the module before editing its package-owned configuration.
          </Text>
        </Card>
      ) : (
        <Card title={module.admin.title} description={module.admin.description}>
          {module.admin.fields.map((field) => (
            <Field key={field.key} label={`${field.label}${field.required ? ' *' : ''}`}>
              <Input
                accessibilityLabel={field.label}
                value={draft[field.key] ?? ''}
                multiline={field.control !== 'text' && field.control !== 'string-list'}
                autoCapitalize="none"
                onChangeText={(value) =>
                  setDraft((current) => ({ ...current, [field.key]: value }))
                }
              />
              {field.control === 'string-list' ? (
                <Text color="neutral" emphasis="muted" variant="caption">
                  Comma-separated values
                </Text>
              ) : null}
              {field.control !== 'text' && field.control !== 'string-list' ? (
                <Text color="neutral" emphasis="muted" variant="caption">
                  JSON value
                </Text>
              ) : null}
            </Field>
          ))}
          <Button loading={busy} onPress={() => void saveConfig()}>
            Save configuration
          </Button>
        </Card>
      )}
    </AdminScroll>
  );
}

function toMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

const styles = StyleSheet.create({
  statusGrid: {
    gap: 8,
  },
});
