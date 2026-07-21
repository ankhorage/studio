import type { AppCategory } from '@ankhorage/contracts';
import { Heading, Icon, Text, useZoraTheme } from '@ankhorage/zora';
import { router, useLocalSearchParams } from 'expo-router';
import React, { useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Linking,
  Pressable,
  ScrollView,
  StyleSheet,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import {
  ProjectCreationError,
  type LaunchProjectResponse,
  useProjects,
} from '../../hooks/useProjects';
import { useTemplateCatalog } from '../../hooks/useTemplateCatalog';
import type { ProjectSortKey, StudioProjectSummary } from '../../projectWorkspaceContracts';
import type { TemplateCatalogCategory, TemplateEntry } from '../../templateCatalogContracts';
import { confirmDelete, openProjectUrl } from '../../workspacePlatform';
import { filterAndSortProjects, filterAndSortTemplates } from '../../workspaceSearch';
import { resolveCreateProjectFormState } from './createProjectFormState';
import { resolveWorkspaceCategoryParam } from './routeParams';

export function ProjectsOverviewScreen() {
  const { projects, isLoading, error, refresh } = useProjects();
  const { theme } = useZoraTheme();
  const [searchQuery, setSearchQuery] = useState('');
  const [sort, setSort] = useState<ProjectSortKey>('updated-desc');

  const filteredProjects = useMemo(
    () => filterAndSortProjects(projects, searchQuery, sort),
    [projects, searchQuery, sort],
  );

  return (
    <WorkspaceScreen title="Projects" subtitle="Choose a workspace project.">
      <View style={styles.toolbar}>
        <TextInput
          value={searchQuery}
          onChangeText={setSearchQuery}
          placeholder="Search projects"
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
        <SegmentedControl
          value={sort}
          options={[
            { label: 'Updated', value: 'updated-desc' },
            { label: 'Name', value: 'name-asc' },
          ]}
          onChange={(value) => setSort(value)}
        />
        <PrimaryAction
          iconName="add-outline"
          label="New project"
          onPress={() => router.push('/create')}
        />
      </View>

      {isLoading ? (
        <LoadingState label="Loading projects" />
      ) : error ? (
        <EmptyState
          title="Host connection failed"
          detail={error}
          actionLabel="Retry"
          onAction={refresh}
        />
      ) : filteredProjects.length === 0 ? (
        <EmptyState
          title={searchQuery.trim() ? 'No matching projects' : 'No projects yet'}
          detail={
            searchQuery.trim()
              ? 'Clear search or choose a different project query.'
              : 'Create the first generated app for this workspace.'
          }
          actionLabel={searchQuery.trim() ? 'Clear search' : 'New project'}
          onAction={() => {
            if (searchQuery.trim()) {
              setSearchQuery('');
            } else {
              router.push('/create');
            }
          }}
        />
      ) : (
        <View style={styles.projectGrid}>
          {filteredProjects.map((project) => (
            <ProjectOverviewCard
              key={project.id}
              project={project}
              onPress={() => router.push(`/projects/${project.id}`)}
            />
          ))}
        </View>
      )}
    </WorkspaceScreen>
  );
}

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

  const handleDelete = () => {
    if (!project) return;
    const confirmed = confirmDelete(project.name);
    if (confirmed) {
      void runAction('Delete project', async () => {
        await deleteProject(project.id);
        router.replace('/');
        return `Deleted ${project.name}.`;
      });
      return;
    }

    Alert.alert('Delete project', `Delete ${project.name}?`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: () =>
          void runAction('Delete project', async () => {
            await deleteProject(project.id);
            router.replace('/');
            return `Deleted ${project.name}.`;
          }),
      },
    ]);
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

export function CreateCategoriesScreen() {
  const { catalog, isLoading, error, refresh } = useTemplateCatalog();
  const [searchQuery, setSearchQuery] = useState('');
  const results = useMemo(
    () => (searchQuery.trim() ? filterAndSortTemplates(catalog, searchQuery) : []),
    [catalog, searchQuery],
  );

  return (
    <WorkspaceScreen title="New Project" subtitle="Choose a category first.">
      <View style={styles.toolbar}>
        <TextInput
          value={searchQuery}
          onChangeText={setSearchQuery}
          placeholder="Search templates globally"
          placeholderTextColor="#8a8f98"
          style={styles.searchInput}
        />
      </View>

      {isLoading ? (
        <LoadingState label="Loading template catalog" />
      ) : error ? (
        <EmptyState
          title="Catalog load failed"
          detail={error}
          actionLabel="Retry"
          onAction={refresh}
        />
      ) : searchQuery.trim() ? (
        <SearchResults
          query={searchQuery}
          results={results}
          onClear={() => setSearchQuery('')}
          onPress={(template) => router.push(`/create/${template.category}/${template.templateId}`)}
        />
      ) : (
        <View style={styles.categoryGrid}>
          {catalog.categories.map((category) => (
            <CategoryCard
              key={category.id}
              category={category}
              onPress={() => router.push(`/create/${category.id}`)}
            />
          ))}
        </View>
      )}
    </WorkspaceScreen>
  );
}

export function CreateCategoryTemplatesScreen() {
  const { category, categoryParam } = useCategoryRouteParams();
  const { catalog, isLoading, error, refresh } = useTemplateCatalog();
  const selected = category ? catalog.categories.find((entry) => entry.id === category) : undefined;

  return (
    <WorkspaceScreen title={selected?.label ?? 'Templates'} subtitle={categoryParam}>
      {isLoading ? (
        <LoadingState label="Loading templates" />
      ) : error ? (
        <EmptyState
          title="Catalog load failed"
          detail={error}
          actionLabel="Retry"
          onAction={refresh}
        />
      ) : !selected ? (
        <EmptyState
          title="Category not found"
          detail={`The requested template category "${categoryParam}" is not available.`}
          actionLabel="Back to categories"
          onAction={() => router.replace('/create')}
        />
      ) : selected.templates.length === 0 ? (
        <EmptyState
          title="No templates in this category"
          detail="Choose a different category."
          actionLabel="Back to categories"
          onAction={() => router.push('/create')}
        />
      ) : (
        <View style={styles.templateGrid}>
          {selected.templates.map((template) => (
            <TemplateCard
              key={template.id}
              template={template}
              onPress={() => router.push(`/create/${category}/${template.templateId}`)}
            />
          ))}
        </View>
      )}
    </WorkspaceScreen>
  );
}

export function CreateProjectFromTemplateScreen() {
  const { category, categoryParam, templateId } = useTemplateRouteParams();
  const { catalog, isLoading, error, refresh } = useTemplateCatalog();
  const {
    projects,
    isLoading: projectsLoading,
    error: projectsError,
    refresh: refreshProjects,
    createProject,
  } = useProjects();
  const selectedCategory = category
    ? catalog.categories.find((entry) => entry.id === category)
    : undefined;
  const template = selectedCategory?.templates.find((entry) => entry.templateId === templateId);
  const [projectName, setProjectName] = useState('');
  const [isCreating, setIsCreating] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const formState = useMemo(
    () =>
      resolveCreateProjectFormState({
        projectName,
        existingProjects: projects,
        projectsLoading,
        projectsError,
        templateAvailable: template !== undefined,
        isCreating,
      }),
    [projectName, projects, projectsLoading, projectsError, template, isCreating],
  );

  async function handleCreate() {
    if (!category || !template || formState.validation?.ok !== true) return;
    setIsCreating(true);
    setSubmitError(null);
    try {
      const result = await createProject({
        category,
        templateId: template.templateId,
        name: projectName,
      });
      router.replace(`/projects/${result.id}`);
    } catch (caught) {
      console.error(caught);
      setSubmitError(
        caught instanceof ProjectCreationError ? caught.reason.message : 'Project creation failed.',
      );
    } finally {
      setIsCreating(false);
    }
  }

  return (
    <WorkspaceScreen title="Create Project" subtitle={selectedCategory?.label ?? categoryParam}>
      {isLoading ? (
        <LoadingState label="Loading template" />
      ) : error ? (
        <EmptyState
          title="Catalog load failed"
          detail={error}
          actionLabel="Retry"
          onAction={refresh}
        />
      ) : !selectedCategory ? (
        <EmptyState
          title="Category not found"
          detail={`The requested template category "${categoryParam}" is not available.`}
          actionLabel="Back to categories"
          onAction={() => router.replace('/create')}
        />
      ) : !template ? (
        <EmptyState
          title="Template not found"
          detail="The selected template is not available."
          actionLabel="Back to templates"
          onAction={() => router.replace(`/create/${selectedCategory.id}`)}
        />
      ) : (
        <View style={styles.createLayout}>
          <View style={styles.detailPanel}>
            <Text color="neutral" emphasis="muted" variant="caption">
              Template
            </Text>
            <Heading level={2} text={template.name} />
            <Text color="neutral" emphasis="muted">
              {template.description}
            </Text>
          </View>
          <View style={styles.lifecyclePanel}>
            <Heading level={3} text="Project" />
            <View style={styles.fieldGroup}>
              <Text weight="semiBold">Project name</Text>
              <TextInput
                value={projectName}
                onChangeText={setProjectName}
                placeholder="Spot the fly"
                placeholderTextColor="#8a8f98"
                style={styles.searchInput}
                accessibilityLabel="Project name"
              />
            </View>
            <MetadataRows
              rows={[['Project ID', formState.derivedProjectId || 'Derived from project name']]}
            />
            {projectsLoading ? (
              <InlineMessage tone="info" text="Loading existing projects." />
            ) : null}
            {projectsError ? (
              <View style={styles.actionStack}>
                <InlineMessage tone="error" text={projectsError} />
                <SecondaryAction label="Retry projects" onPress={refreshProjects} />
              </View>
            ) : null}
            {formState.validation?.ok === false && projectName.trim() ? (
              <InlineMessage tone="error" text={formState.validation.reason.message} />
            ) : null}
            {submitError ? <InlineMessage tone="error" text={submitError} /> : null}
            <PrimaryAction
              iconName="checkmark-outline"
              label={isCreating ? 'Creating' : 'Create project'}
              disabled={!formState.canCreate}
              onPress={() => void handleCreate()}
            />
          </View>
        </View>
      )}
    </WorkspaceScreen>
  );
}

function WorkspaceScreen(props: { title: string; subtitle: string; children: React.ReactNode }) {
  const { theme } = useZoraTheme();

  return (
    <SafeAreaView
      edges={['left', 'right', 'bottom']}
      style={[styles.safeArea, { backgroundColor: theme.colors.background }]}
    >
      <ScrollView style={styles.scroll} contentContainerStyle={styles.screenContent}>
        <View style={styles.screenHeader}>
          <Heading level={1} text={props.title} />
          <Text color="neutral" emphasis="muted">
            {props.subtitle}
          </Text>
        </View>
        {props.children}
      </ScrollView>
    </SafeAreaView>
  );
}

function ProjectOverviewCard(props: { project: StudioProjectSummary; onPress: () => void }) {
  const { theme } = useZoraTheme();
  const mode = props.project.activeThemeMode ?? 'light';
  const accent = props.project.activeTheme[mode].primaryColor;

  return (
    <Pressable
      onPress={props.onPress}
      accessibilityRole="button"
      accessibilityLabel={`Open ${props.project.name}`}
      style={({ pressed }) => [
        styles.projectCard,
        {
          borderColor: theme.colors.border,
          backgroundColor: theme.colors.surface,
          opacity: pressed ? 0.82 : 1,
        },
      ]}
    >
      <View style={[styles.themeStripe, { backgroundColor: accent }]} />
      <View style={styles.cardBody}>
        <Text numberOfLines={1} variant="bodySmall" weight="semiBold">
          {props.project.name}
        </Text>
        <Text color="neutral" emphasis="muted" variant="caption">
          {props.project.version} · {formatCategory(props.project.category)}
        </Text>
        <Text color="neutral" emphasis="muted" variant="caption">
          Updated {formatDate(props.project.updated)}
        </Text>
      </View>
    </Pressable>
  );
}

function CategoryCard(props: { category: TemplateCatalogCategory; onPress: () => void }) {
  const { theme } = useZoraTheme();

  return (
    <Pressable
      onPress={props.onPress}
      accessibilityRole="button"
      accessibilityLabel={`Browse ${props.category.label} templates`}
      style={({ pressed }) => [
        styles.categoryCard,
        {
          borderColor: theme.colors.border,
          backgroundColor: theme.colors.surface,
          opacity: pressed ? 0.82 : 1,
        },
      ]}
    >
      <View style={[styles.categoryAccent, { backgroundColor: props.category.primaryColor }]} />
      <Text numberOfLines={1} weight="semiBold">
        {props.category.label}
      </Text>
      <Text color="neutral" emphasis="muted" variant="bodySmall">
        {props.category.summary}
      </Text>
      <Text color="neutral" emphasis="muted" variant="caption">
        {props.category.templateCount} templates
      </Text>
    </Pressable>
  );
}

function TemplateCard(props: {
  template: { name: string; description: string };
  onPress: () => void;
}) {
  const { theme } = useZoraTheme();

  return (
    <Pressable
      onPress={props.onPress}
      accessibilityRole="button"
      accessibilityLabel={`Select ${props.template.name}`}
      style={({ pressed }) => [
        styles.templateCard,
        {
          borderColor: theme.colors.border,
          backgroundColor: theme.colors.surface,
          opacity: pressed ? 0.82 : 1,
        },
      ]}
    >
      <Text numberOfLines={1} weight="semiBold">
        {props.template.name}
      </Text>
      <Text color="neutral" emphasis="muted" variant="bodySmall">
        {props.template.description}
      </Text>
    </Pressable>
  );
}

function SearchResults(props: {
  query: string;
  results: TemplateEntry[];
  onClear: () => void;
  onPress: (template: TemplateEntry) => void;
}) {
  return (
    <View style={styles.actionStack}>
      <View style={styles.resultsHeader}>
        <Text color="neutral" emphasis="muted">
          {props.results.length} results for "{props.query}"
        </Text>
        <SecondaryAction label="Clear search" onPress={props.onClear} />
      </View>
      {props.results.length === 0 ? (
        <EmptyState
          title="No matching templates"
          detail="Search by template name, description, category label, or category ID."
          actionLabel="Clear search"
          onAction={props.onClear}
        />
      ) : (
        <View style={styles.templateGrid}>
          {props.results.map((template) => (
            <TemplateCard
              key={template.id}
              template={{
                name: template.name,
                description: `${template.categoryLabel}: ${template.description}`,
              }}
              onPress={() => props.onPress(template)}
            />
          ))}
        </View>
      )}
    </View>
  );
}

function LifecycleAction(props: {
  iconName: string;
  label: string;
  detail: string;
  loading: boolean;
  disabled: boolean;
  destructive?: boolean;
  onPress: () => void;
}) {
  const { theme } = useZoraTheme();

  return (
    <Pressable
      onPress={props.onPress}
      disabled={props.disabled}
      accessibilityRole="button"
      accessibilityLabel={props.label}
      style={({ pressed }) => [
        styles.lifecycleAction,
        {
          borderColor: theme.colors.border,
          backgroundColor: theme.colors.surface,
          opacity: props.disabled && !props.loading ? 0.55 : pressed ? 0.82 : 1,
        },
      ]}
    >
      {props.loading ? (
        <ActivityIndicator />
      ) : (
        <Icon name={props.iconName} size={20} color={props.destructive ? 'error' : 'primary'} />
      )}
      <View style={styles.lifecycleCopy}>
        <Text weight="semiBold">{props.label}</Text>
        <Text color="neutral" emphasis="muted" variant="caption">
          {props.detail}
        </Text>
      </View>
    </Pressable>
  );
}

function PrimaryAction(props: {
  iconName: string;
  label: string;
  disabled?: boolean;
  onPress: () => void;
}) {
  const { theme } = useZoraTheme();

  return (
    <Pressable
      onPress={props.onPress}
      disabled={props.disabled}
      accessibilityRole="button"
      accessibilityLabel={props.label}
      style={({ pressed }) => [
        styles.primaryAction,
        {
          backgroundColor: theme.colors.primary,
          borderColor: theme.colors.primary,
          opacity: props.disabled ? 0.48 : pressed ? 0.82 : 1,
        },
      ]}
    >
      <Icon name={props.iconName} size={18} color="#fff" />
      <Text color="neutral" emphasis="inverse" weight="semiBold">
        {props.label}
      </Text>
    </Pressable>
  );
}

function SecondaryAction(props: { label: string; onPress: () => void }) {
  const { theme } = useZoraTheme();

  return (
    <Pressable
      onPress={props.onPress}
      accessibilityRole="button"
      accessibilityLabel={props.label}
      style={({ pressed }) => [
        styles.secondaryAction,
        {
          borderColor: theme.colors.border,
          opacity: pressed ? 0.82 : 1,
        },
      ]}
    >
      <Text weight="semiBold">{props.label}</Text>
    </Pressable>
  );
}

function SegmentedControl<TValue extends string>(props: {
  value: TValue;
  options: readonly { label: string; value: TValue }[];
  onChange: (value: TValue) => void;
}) {
  const { theme } = useZoraTheme();

  return (
    <View style={[styles.segmented, { borderColor: theme.colors.border }]}>
      {props.options.map((option) => {
        const selected = option.value === props.value;
        return (
          <Pressable
            key={option.value}
            onPress={() => props.onChange(option.value)}
            accessibilityRole="button"
            accessibilityState={{ selected }}
            style={[
              styles.segment,
              selected ? { backgroundColor: theme.colors.primary } : undefined,
            ]}
          >
            <Text
              color={selected ? 'neutral' : 'neutral'}
              emphasis={selected ? 'inverse' : 'default'}
              variant="bodySmall"
              weight="semiBold"
            >
              {option.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

function MetadataRows(props: { rows: readonly (readonly [string, string])[] }) {
  return (
    <View style={styles.metadata}>
      {props.rows.map(([label, value]) => (
        <View key={label} style={styles.metadataRow}>
          <Text color="neutral" emphasis="muted" variant="caption">
            {label}
          </Text>
          <Text selectable variant="bodySmall">
            {value}
          </Text>
        </View>
      ))}
    </View>
  );
}

function InlineMessage(props: { tone: 'success' | 'error' | 'info'; text: string }) {
  const { theme } = useZoraTheme();
  const borderColor = props.tone === 'error' ? theme.colors.danger : theme.colors.primary;

  return (
    <View style={[styles.inlineMessage, { borderColor }]}>
      <Text color={props.tone === 'error' ? 'danger' : 'primary'} variant="bodySmall">
        {props.text}
      </Text>
    </View>
  );
}

function LoadingState(props: { label: string }) {
  const { theme } = useZoraTheme();
  return (
    <View style={styles.emptyState}>
      <ActivityIndicator color={theme.colors.primary} />
      <Text color="neutral" emphasis="muted">
        {props.label}
      </Text>
    </View>
  );
}

function EmptyState(props: {
  title: string;
  detail: string;
  actionLabel?: string;
  onAction?: () => void;
}) {
  const { theme } = useZoraTheme();
  return (
    <View style={[styles.emptyState, { borderColor: theme.colors.border }]}>
      <Text weight="semiBold">{props.title}</Text>
      <Text align="center" color="neutral" emphasis="muted">
        {props.detail}
      </Text>
      {props.actionLabel && props.onAction ? (
        <SecondaryAction label={props.actionLabel} onPress={props.onAction} />
      ) : null}
    </View>
  );
}

function useProjectRouteParams() {
  const params = useLocalSearchParams<{ projectId?: string }>();
  return { projectId: firstParam(params.projectId) };
}

function useCategoryRouteParams() {
  const params = useLocalSearchParams<{ category?: string }>();
  return resolveWorkspaceCategoryParam(firstParam(params.category));
}

function useTemplateRouteParams() {
  const params = useLocalSearchParams<{ category?: string; templateId?: string }>();
  const category = resolveWorkspaceCategoryParam(firstParam(params.category));
  return {
    ...category,
    templateId: firstParam(params.templateId),
  };
}

function firstParam(value: string | string[] | undefined): string {
  return Array.isArray(value) ? (value[0] ?? '') : (value ?? '');
}

function formatCategory(category: AppCategory): string {
  return category
    .split('_')
    .map((part) => `${part.charAt(0).toUpperCase()}${part.slice(1)}`)
    .join(' ');
}

function formatDate(value: string | undefined): string {
  if (!value) return 'Not recorded';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString();
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
  },
  scroll: {
    flex: 1,
  },
  screenContent: {
    width: '100%',
    maxWidth: 1180,
    alignSelf: 'center',
    padding: 20,
    paddingBottom: 48,
    gap: 20,
  },
  screenHeader: {
    gap: 4,
  },
  toolbar: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: 12,
  },
  searchInput: {
    minWidth: 240,
    minHeight: 42,
    flexGrow: 1,
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  segmented: {
    flexDirection: 'row',
    borderWidth: 1,
    borderRadius: 8,
    overflow: 'hidden',
  },
  segment: {
    minHeight: 40,
    paddingHorizontal: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  primaryAction: {
    minHeight: 42,
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  secondaryAction: {
    minHeight: 38,
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  projectGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  projectCard: {
    width: 260,
    minHeight: 132,
    borderWidth: 1,
    borderRadius: 8,
    overflow: 'hidden',
  },
  themeStripe: {
    height: 5,
    width: '100%',
  },
  cardBody: {
    padding: 14,
    gap: 8,
  },
  categoryGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  categoryCard: {
    width: 260,
    minHeight: 158,
    borderWidth: 1,
    borderRadius: 8,
    padding: 14,
    gap: 8,
  },
  categoryAccent: {
    width: 32,
    height: 4,
    borderRadius: 2,
  },
  templateGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  templateCard: {
    width: 280,
    minHeight: 118,
    borderWidth: 1,
    borderRadius: 8,
    padding: 14,
    gap: 8,
  },
  detailLayout: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 16,
    alignItems: 'flex-start',
  },
  createLayout: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 16,
    alignItems: 'flex-start',
  },
  detailPanel: {
    minWidth: 300,
    flex: 1,
    gap: 14,
  },
  lifecyclePanel: {
    minWidth: 300,
    flex: 1,
    gap: 14,
  },
  actionStack: {
    gap: 10,
  },
  lifecycleAction: {
    minHeight: 72,
    borderWidth: 1,
    borderRadius: 8,
    padding: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  lifecycleCopy: {
    flex: 1,
    gap: 2,
  },
  metadata: {
    gap: 8,
  },
  metadataRow: {
    gap: 2,
  },
  inlineMessage: {
    borderWidth: 1,
    borderRadius: 8,
    padding: 10,
  },
  emptyState: {
    minHeight: 160,
    borderWidth: 1,
    borderStyle: 'dashed',
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
    gap: 12,
  },
  fieldGroup: {
    gap: 8,
  },
  resultsHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
    flexWrap: 'wrap',
  },
});
