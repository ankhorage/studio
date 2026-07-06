import { Heading, Icon, Text, useZoraTheme } from '@ankhorage/zora';
import React, { useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Linking,
  ScrollView,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import type { LaunchProjectResponse } from '../hooks/useProjects';
import { useProjects } from '../hooks/useProjects';
import { useTemplateSummaries } from '../hooks/useTemplateSummaries';
import { confirmDelete, openProjectUrl, promptProjectName } from '../modules/dashboard/platform';
import { filterAndSortProjects, filterAndSortTemplates } from '../modules/dashboard/search';
import { getTemplateEntries } from '../modules/dashboard/templates';
import type { ProjectItem, TemplateEntry } from '../modules/dashboard/types';
import { DashboardSectionHeader } from '../modules/dashboard/ui/DashboardSectionHeader';
import { ProjectCard } from '../modules/dashboard/ui/ProjectCard';
import { TemplateCard } from '../modules/dashboard/ui/TemplateCard';

export function StudioDashboard() {
  const {
    projects,
    isLoading,
    error,
    createProject,
    deleteProject,
    syncProject,
    installWorkspacePackages,
    upProjectInfrastructure,
    launchProject,
  } = useProjects();
  const {
    templates,
    isLoading: areTemplatesLoading,
    error: templatesError,
  } = useTemplateSummaries();
  const { theme, mode, setMode } = useZoraTheme();

  const [isCreating, setIsCreating] = useState(false);
  const [syncingProjectId, setSyncingProjectId] = useState<string | null>(null);
  const [launchingProjectId, setLaunchingProjectId] = useState<string | null>(null);
  const [installingProjectId, setInstallingProjectId] = useState<string | null>(null);
  const [infraReloadProjectId, setInfraReloadProjectId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');

  const templateEntries = useMemo(() => getTemplateEntries(templates), [templates]);

  const filteredProjects = useMemo(
    () => filterAndSortProjects(projects, searchQuery).filter((p) => p.id !== 'studio'),
    [projects, searchQuery],
  );

  const filteredTemplates = useMemo(
    () => filterAndSortTemplates(templateEntries, searchQuery),
    [templateEntries, searchQuery],
  );

  const handleSync = async (projectId: string) => {
    setSyncingProjectId(projectId);
    try {
      await syncProject(projectId);
      Alert.alert('Success', 'Project synchronized!');
    } catch (e: unknown) {
      console.error(e);
      Alert.alert('Error', 'Failed to sync project.');
    } finally {
      setSyncingProjectId(null);
    }
  };

  const handleCreate = async (template: TemplateEntry) => {
    const defaultName = `my-app-${Math.floor(Math.random() * 1000)}`;
    const name = promptProjectName(defaultName);
    if (!name) return;

    setIsCreating(true);
    try {
      await createProject({
        category: template.category,
        templateId: template.templateId,
        name,
      });
      Alert.alert('Success', `Project ${name} created!`);
    } catch (e: unknown) {
      console.error(e);
      Alert.alert('Error', 'Failed to create project.');
    } finally {
      setIsCreating(false);
    }
  };

  const handleInstallPackages = async (projectId: string) => {
    setInstallingProjectId(projectId);
    try {
      await installWorkspacePackages();
      Alert.alert('Success', 'Workspace packages installed.');
    } catch (e: unknown) {
      console.error(e);
      Alert.alert('Error', 'Failed to install workspace packages.');
    } finally {
      setInstallingProjectId(null);
    }
  };

  const handleReloadInfra = async (projectId: string) => {
    setInfraReloadProjectId(projectId);
    try {
      await upProjectInfrastructure(projectId);
      Alert.alert('Success', 'Infrastructure initialized/reloaded.');
    } catch (e: unknown) {
      console.error(e);
      Alert.alert('Error', 'Failed to initialize/reload infrastructure.');
    } finally {
      setInfraReloadProjectId(null);
    }
  };

  const handleLaunch = async (projectId: string) => {
    setLaunchingProjectId(projectId);
    try {
      const response: LaunchProjectResponse = await launchProject(projectId);
      const url = typeof response.url === 'string' ? response.url : '';
      if (!url) {
        throw new Error('No launch URL returned by backend.');
      }

      const openedInNewTab = openProjectUrl(url);
      if (!openedInNewTab) {
        await Linking.openURL(url);
      }

      const statusPrefix =
        response.started === false ? 'App runtime already running.' : 'App runtime started.';
      Alert.alert('App Launch', `${statusPrefix}\nURL: ${url}`);
    } catch (e: unknown) {
      console.error(e);
      Alert.alert('Error', 'Failed to launch project app.');
    } finally {
      setLaunchingProjectId(null);
    }
  };

  const handleDelete = (project: ProjectItem) => {
    if (confirmDelete(project.name)) {
      void deleteProject(project.id);
      return;
    }

    Alert.alert('Delete', `Delete ${project.name}?`, [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: () => void deleteProject(project.id) },
    ]);
  };

  const handleLaunchPress = (projectId: string) => {
    void handleLaunch(projectId);
  };

  const handleSyncPress = (projectId: string) => {
    void handleSync(projectId);
  };

  const handleInstallPackagesPress = (projectId: string) => {
    void handleInstallPackages(projectId);
  };

  const handleReloadInfraPress = (projectId: string) => {
    void handleReloadInfra(projectId);
  };

  const handleCreatePress = (template: TemplateEntry) => {
    void handleCreate(template);
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: theme.colors.background }}>
      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{ flex: 1, padding: 20, paddingBottom: 40 }}
      >
        <View style={styles.header}>
          <Heading level={1} text="ANKH STUDIO" />
          <Text
            align="center"
            color={error ? 'danger' : 'neutral'}
            emphasis={error ? 'default' : 'muted'}
            variant="bodySmall"
          >
            {error ?? 'Project Dashboard'}
          </Text>
        </View>

        <View style={styles.toolbar}>
          <View style={{ flex: 1, maxWidth: 400 }}>
            <TextInput
              value={searchQuery}
              onChangeText={setSearchQuery}
              placeholder="Search projects, categories, and templates..."
              placeholderTextColor={theme.colors.textMuted}
              style={[
                styles.searchInput,
                {
                  color: theme.colors.text,
                  backgroundColor: theme.colors.surface,
                  borderColor: theme.colors.border,
                },
              ]}
            />
          </View>

          <TouchableOpacity
            onPress={() => setMode(mode === 'dark' ? 'light' : 'dark')}
            style={{ padding: 8 }}
          >
            <Icon
              name={mode === 'dark' ? 'moon' : 'sunny'}
              provider="Ionicons"
              size={24}
              color="text"
            />
          </TouchableOpacity>
        </View>

        <DashboardSectionHeader icon="folder-open-outline" title="YOUR PROJECTS" />

        {isLoading ? (
          <ActivityIndicator color={theme.colors.primary} style={{ margin: 20 }} />
        ) : filteredProjects.length === 0 ? (
          <View
            style={{
              ...styles.emptyState,
              borderStyle: 'dashed',
              borderWidth: 1,
              borderColor: theme.colors.border,
            }}
          >
            <Text align="center" color="neutral" emphasis="muted">
              {searchQuery.trim()
                ? 'No projects match your search.'
                : 'No projects found in /apps folder.'}
            </Text>
          </View>
        ) : (
          <View style={styles.grid}>
            {filteredProjects.map((p) => (
              <ProjectCard
                key={p.id}
                project={p}
                borderColor={theme.colors.border}
                isSyncing={syncingProjectId === p.id}
                isLaunching={launchingProjectId === p.id}
                isInstallingPackages={installingProjectId === p.id}
                isReloadingInfra={infraReloadProjectId === p.id}
                onLaunch={() => handleLaunchPress(p.id)}
                onSync={() => handleSyncPress(p.id)}
                onInstallPackages={() => handleInstallPackagesPress(p.id)}
                onReloadInfra={() => handleReloadInfraPress(p.id)}
                onDelete={() => handleDelete(p)}
              />
            ))}
          </View>
        )}

        <DashboardSectionHeader icon="duplicate-outline" title="START NEW PROJECT" />

        <View style={styles.grid}>
          {areTemplatesLoading ? (
            <ActivityIndicator color={theme.colors.primary} style={{ margin: 20 }} />
          ) : filteredTemplates.length === 0 ? (
            <View style={styles.emptyState}>
              <Text align="center" color="neutral" emphasis="muted">
                {templatesError ?? 'No templates match your search.'}
              </Text>
            </View>
          ) : (
            filteredTemplates.map((template) => (
              <TemplateCard
                key={template.id}
                template={template}
                disabled={isCreating}
                mode={mode}
                borderColor={theme.colors.border}
                onPress={() => handleCreatePress(template)}
              />
            ))
          )}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  header: {
    alignItems: 'center',
    marginBottom: 16,
  },
  headerSubtitle: {
    marginTop: 4,
    fontSize: 13,
  },
  toolbar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
    marginBottom: 24,
    paddingHorizontal: 16,
  },
  searchInput: {
    minHeight: 42,
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  emptyState: {
    padding: 24,
    alignItems: 'center',
    borderRadius: 8,
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    gap: 16,
    paddingBottom: 16,
  },
});
