import { Button, ButtonGroup, Card, Text } from '@ankhorage/zora';
import { useRouter } from 'expo-router';
import React, { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, StyleSheet, View } from 'react-native';

import { useStudio } from '../../../core/StudioContext';
import type { StudioModuleState } from '../../../moduleAdminContracts';
import {
  finalizePendingProjectModules,
  installProjectModule,
  listProjectModules,
  uninstallProjectModule,
} from '../../../moduleAdminApi';
import { createStudioModuleRoutePath } from '../../../studioAdminRouteModel';
import { AdminHeader, AdminScroll, KeyValue } from '../adminPagePrimitives';

/*** Render the project module catalog, lifecycle actions, pending-removal finalization, and navigation to module details. */
export function ModulesAdminPage() {
  const studio = useStudio();
  const router = useRouter();
  const [modules, setModules] = useState<readonly StudioModuleState[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [finalizing, setFinalizing] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  /*** Reload all registered/installed module lifecycle state for the active Studio project. */
  const reload = useCallback(async () => {
    setLoading(true);
    try {
      setModules(await listProjectModules(studio.projectId));
      setMessage(null);
    } catch (error) {
      setMessage(toMessage(error));
    } finally {
      setLoading(false);
    }
  }, [studio.projectId]);

  useEffect(() => {
    void reload();
  }, [reload]);

  /*** Install or uninstall one module and refresh both manifest and module lifecycle state afterwards. */
  const runLifecycle = useCallback(
    async (module: StudioModuleState, operation: 'install' | 'uninstall') => {
      setBusyId(module.id);
      setMessage(null);
      try {
        const result =
          operation === 'install'
            ? await installProjectModule({ projectId: studio.projectId, moduleId: module.id })
            : await uninstallProjectModule({ projectId: studio.projectId, moduleId: module.id });
        setMessage(
          result.pending
            ? `${module.name} removal is pending. Reload the generated app before finalizing it.`
            : `${module.name} ${operation === 'install' ? 'installed' : 'removed'}.`,
        );
        await studio.refetchManifest();
        setModules(await listProjectModules(studio.projectId));
      } catch (error) {
        setMessage(toMessage(error));
      } finally {
        setBusyId(null);
      }
    },
    [studio],
  );

  /*** Finalize all pending module removals after the generated app has released package-owned state. */
  const finalizePending = useCallback(async () => {
    setFinalizing(true);
    setMessage(null);
    try {
      const applied = await finalizePendingProjectModules(studio.projectId);
      setMessage(`Finalized ${applied} pending module removal${applied === 1 ? '' : 's'}.`);
      await studio.refetchManifest();
      setModules(await listProjectModules(studio.projectId));
    } catch (error) {
      setMessage(toMessage(error));
    } finally {
      setFinalizing(false);
    }
  }, [studio]);

  return (
    <AdminScroll>
      <AdminHeader
        title="Modules"
        description="Lifecycle and configuration state comes from the standalone Orchestrator."
      />
      {loading ? <ActivityIndicator accessibilityLabel="Loading modules" /> : null}
      {message ? (
        <Text color="neutral" emphasis="muted" variant="bodySmall">
          {message}
        </Text>
      ) : null}
      {!loading && modules.length === 0 ? (
        <Card title="No modules available">
          <Text color="neutral" emphasis="muted">
            The host registry and Orchestrator lifecycle contain no modules for this project.
          </Text>
        </Card>
      ) : null}
      {modules.some((module) => module.pendingRemoval) ? (
        <Card title="Pending module removal">
          <Text color="neutral" emphasis="muted">
            Reload the generated app first, then finalize to let Orchestrator remove package-owned
            files and lifecycle state safely.
          </Text>
          <Button
            loading={finalizing}
            disabled={busyId !== null}
            onPress={() => void finalizePending()}
          >
            Finalize pending removals
          </Button>
        </Card>
      ) : null}
      {modules.map((module) => (
        <Card key={module.id} title={module.name} description={module.description}>
          <View style={styles.statusGrid}>
            <KeyValue label="Module ID" value={module.id} />
            <KeyValue label="Status" value={formatStatus(module)} />
            <KeyValue
              label="Version"
              value={module.installedVersion ?? module.registrationVersion ?? 'not reported'}
            />
            <KeyValue
              label="Dependencies"
              value={module.dependencies.length > 0 ? module.dependencies.join(', ') : 'none'}
            />
          </View>
          <ButtonGroup orientation="responsive" align="start">
            <Button
              variant="outline"
              onPress={() => router.push(createStudioModuleRoutePath(module.id))}
            >
              {module.installed && module.admin ? 'Configure' : 'Details'}
            </Button>
            {!module.installed && module.available ? (
              <Button
                loading={busyId === module.id}
                disabled={busyId !== null || finalizing}
                onPress={() => void runLifecycle(module, 'install')}
              >
                Install
              </Button>
            ) : null}
            {module.installed && !module.pendingRemoval ? (
              <Button
                color="danger"
                variant="outline"
                loading={busyId === module.id}
                disabled={busyId !== null || finalizing || module.dependents.length > 0}
                onPress={() => void runLifecycle(module, 'uninstall')}
              >
                Uninstall
              </Button>
            ) : null}
          </ButtonGroup>
        </Card>
      ))}
    </AdminScroll>
  );
}

/*** Format the lifecycle availability/installation/pending-removal state of one Studio module for display. */
function formatStatus(module: StudioModuleState): string {
  if (module.pendingRemoval) return 'pending removal';
  if (module.installed && !module.available) return 'installed, unavailable';
  if (module.installed) return 'installed';
  return module.available ? 'available' : 'unavailable';
}

/***
 * Normalize an unknown thrown value to a display message.
 * @utility @ankhorage/utility/error
 */
function toMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

const styles = StyleSheet.create({
  statusGrid: {
    gap: 8,
  },
});
