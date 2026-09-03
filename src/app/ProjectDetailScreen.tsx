import { Heading } from '@ankhorage/zora';
import { router, useLocalSearchParams } from 'expo-router';
import React, { useState } from 'react';
import { Alert, Linking, View } from 'react-native';

import { type LaunchProjectResponse, useProjects } from '../hooks/useProjects';
import { confirmDelete, openProjectUrl } from '../workspacePlatform';
import {
  EmptyState,
  formatCategory,
  formatDate,
  InlineMessage,
  LifecycleAction,
  LoadingState,
  MetadataRows,
  styles,
  WorkspaceScreen,
} from './workspace/WorkspacePrimitives';

/***
 * Render one project workspace detail screen with metadata, lifecycle actions, host feedback and delete confirmation.
 */
export function ProjectDetailScreen() {
  const { projectId } = useProjectRouteParams();
  const {
    projects,
    isLoading,
    error,
    refresh,
    deleteProject,
    syncProject,
    upProjectInfrastructure,
    launchProject,
  } = useProjects();
  const project = projects.find((candidate) => candidate.id === projectId);
  const [activeAction, setActiveAction] = useState<string | null>(null);
  const [message, setMessage] = useState<{ tone: 'success' | 'error'; text: string } | null>(null);

  /***
   * Execute one project lifecycle UI action with shared busy state, success/error messaging and project-list refresh.
   * @todo Replace the local unknown-error message fallback with the canonical `@ankhorage/utility/error` primitive during Utility consumption.
   */
  async function runAction(label: string, action: () => Promise<string>) {
    setActiveAction(label);
    setMessage(null);
    try {
      const text = await action();
      setMessage({ tone: 'success', text });
      await refresh();
    } catch (caught) {
      console.error(caught);
      setMessage({
        tone: 'error',
        text: caught instanceof Error ? caught.message : `${label} failed.`,
      });
    } finally {
      setActiveAction(null);
    }
  }

  /*** Launch the generated app, validate the returned URL and open it through the platform adapter/fallback. */
  const handleOpenRunningApp = () =>
    runAction('Open running app', async () => {
      const response: LaunchProjectResponse = await launchProject(projectId);
      const url = response.url ?? '';
      if (!url) {
        throw new Error('The host did not return a running app URL.');
      }

      if (!openProjectUrl(url)) {
        await Linking.openURL(url);
      }

      return response.started === false
        ? `Running app already available at ${url}.`
        : `Running app opened at ${url}.`;
    });

  /*** Confirm project deletion, execute the delete lifecycle and return to the project overview. */
  const handleDelete = () => {
    if (!project) return;
    confirmDelete(
      project.name,
      () => {
        void runAction('Delete project', async () => {
          await deleteProject(project.id);
          router.replace('/');
          return `Deleted ${project.name}.`;
        });
      },
      Alert.alert,
    );
  };

  return (
    <WorkspaceScreen title="Project Detail" subtitle={projectId}>
      {isLoading ? (
        <LoadingState label="Loading project" />
      ) : error ? (
        <EmptyState
          title="Host connection failed"
          detail={error}
          actionLabel="Retry"
          onAction={refresh}
        />
      ) : !project ? (
        <EmptyState
          title="Project not found"
          detail="The requested project is not available in this workspace."
          actionLabel="Back to projects"
          onAction={() => router.replace('/')}
        />
      ) : (
        <View style={styles.detailLayout}>
          <View style={styles.detailPanel}>
            <View
              style={[
                styles.themeStripe,
                { backgroundColor: project.activeTheme.light.primaryColor },
              ]}
            />
            <Heading level={2} text={project.name} />
            <MetadataRows
              rows={[
                ['Project ID', project.id],
                ['Version', project.version],
                ['Category', formatCategory(project.category)],
                ['Path', project.path],
                ['Created', formatDate(project.created)],
                ['Updated', formatDate(project.updated)],
              ]}
            />
          </View>

          <View style={styles.lifecyclePanel}>
            <Heading level={3} text="Lifecycle" />
            {message ? <InlineMessage tone={message.tone} text={message.text} /> : null}
            <View style={styles.actionStack}>
              <LifecycleAction
                iconName="refresh-outline"
                label="Sync"
                detail="Synchronize the current Studio manifest and generated files."
                loading={activeAction === 'Sync'}
                disabled={activeAction !== null}
                onPress={() =>
                  void runAction('Sync', async () => {
                    await syncProject(project.id);
                    return 'Project synchronized.';
                  })
                }
              />
              <LifecycleAction
                iconName="cloud-upload-outline"
                label="Infrastructure Up"
                detail="Regenerate artifacts and start the generated infrastructure lifecycle."
                loading={activeAction === 'Infrastructure Up'}
                disabled={activeAction !== null}
                onPress={() =>
                  void runAction('Infrastructure Up', async () => {
                    await upProjectInfrastructure(project.id);
                    return 'Infrastructure up lifecycle completed.';
                  })
                }
              />
              <LifecycleAction
                iconName="open-outline"
                label="Open running app"
                detail="Open the infrastructure-hosted app through the active port-forward."
                loading={activeAction === 'Open running app'}
                disabled={activeAction !== null}
                onPress={handleOpenRunningApp}
              />
              <LifecycleAction
                iconName="trash-outline"
                label="Delete project"
                detail="Delete generated project files after confirmation."
                loading={activeAction === 'Delete project'}
                disabled={activeAction !== null}
                destructive
                onPress={handleDelete}
              />
            </View>
          </View>
        </View>
      )}
    </WorkspaceScreen>
  );
}

/*** Read and normalize the projectId route parameter used by the project-detail screen. */
function useProjectRouteParams() {
  const params = useLocalSearchParams<{ projectId?: string }>();
  return { projectId: firstParam(params.projectId) };
}

/***
 * Normalize a scalar-or-array route/search parameter to its first string value, falling back to an empty string.
 * @utility @ankhorage/utility/url
 */
function firstParam(value: string | string[] | undefined): string {
  return Array.isArray(value) ? (value[0] ?? '') : (value ?? '');
}
