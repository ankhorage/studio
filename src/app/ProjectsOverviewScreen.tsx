import { router } from 'expo-router';
import React, { useMemo, useState } from 'react';
import { View } from 'react-native';

import { useProjects } from '../hooks/useProjects';
import type { ProjectSortKey } from '../projectWorkspaceContracts';
import { filterAndSortProjects } from '../workspaceSearch';
import {
  EmptyState,
  LoadingState,
  PrimaryAction,
  ProjectOverviewCard,
  SegmentedControl,
  styles,
  ThemedWorkspaceTextInput,
  WorkspaceScreen,
} from './workspace/WorkspacePrimitives';

export function ProjectsOverviewScreen() {
  const { projects, isLoading, error, refresh } = useProjects();
  const [searchQuery, setSearchQuery] = useState('');
  const [sort, setSort] = useState<ProjectSortKey>('updated-desc');

  const filteredProjects = useMemo(
    () => filterAndSortProjects(projects, searchQuery, sort),
    [projects, searchQuery, sort],
  );

  return (
    <WorkspaceScreen title="Projects" subtitle="Choose a workspace project.">
      <View style={styles.toolbar}>
        <ThemedWorkspaceTextInput
          value={searchQuery}
          onChangeText={setSearchQuery}
          placeholder="Search projects"
          accessibilityLabel="Search projects"
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
