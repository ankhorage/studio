import { router } from 'expo-router';
import React, { useMemo, useState } from 'react';
import { View } from 'react-native';

import { useTemplateCatalog } from '../hooks/useTemplateCatalog';
import { filterAndSortTemplates } from '../workspaceSearch';
import {
  CategoryCard,
  EmptyState,
  LoadingState,
  SearchResults,
  styles,
  ThemedWorkspaceTextInput,
  WorkspaceScreen,
} from './workspace/WorkspacePrimitives';

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
        <ThemedWorkspaceTextInput
          value={searchQuery}
          onChangeText={setSearchQuery}
          placeholder="Search templates globally"
          accessibilityLabel="Search templates globally"
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
