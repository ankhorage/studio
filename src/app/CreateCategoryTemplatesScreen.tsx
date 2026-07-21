import { router, useLocalSearchParams } from 'expo-router';
import React from 'react';
import { View } from 'react-native';

import { useTemplateCatalog } from '../hooks/useTemplateCatalog';
import {
  EmptyState,
  LoadingState,
  styles,
  TemplateCard,
  WorkspaceScreen,
} from './workspace/WorkspacePrimitives';
import { resolveWorkspaceCategoryParam } from './workspace/routeParams';

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

function useCategoryRouteParams() {
  const params = useLocalSearchParams<{ category?: string }>();
  return resolveWorkspaceCategoryParam(firstParam(params.category));
}

function firstParam(value: string | string[] | undefined): string {
  return Array.isArray(value) ? (value[0] ?? '') : (value ?? '');
}
