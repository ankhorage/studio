import { Heading, Text } from '@ankhorage/zora';
import { router, useLocalSearchParams } from 'expo-router';
import React, { useMemo, useState } from 'react';
import { View } from 'react-native';

import { ProjectCreationError, useProjects } from '../hooks/useProjects';
import { useTemplateCatalog } from '../hooks/useTemplateCatalog';
import {
  EmptyState,
  InlineMessage,
  LoadingState,
  MetadataRows,
  PrimaryAction,
  SecondaryAction,
  styles,
  ThemedWorkspaceTextInput,
  WorkspaceScreen,
} from './workspace/WorkspacePrimitives';
import { resolveCreateProjectFormState } from './workspace/createProjectFormState';
import { resolveWorkspaceCategoryParam } from './workspace/routeParams';

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
              <ThemedWorkspaceTextInput
                value={projectName}
                onChangeText={setProjectName}
                placeholder="Release Monitor"
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
