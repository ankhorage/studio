import {
  AppBar,
  Drawer,
  IconButton,
  Show,
  SidebarLayout,
  Text,
  useZoraTheme,
} from '@ankhorage/zora';
import { Slot, usePathname, useRouter } from 'expo-router';
import React, { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { useStudio } from '../../core/StudioContext';
import type { StudioAdminRouteId } from '../../index';
import {
  createStudioAdminRoutePath,
  getStudioAdminRouteDefinition,
  isStudioAdminRouteActive,
  isStudioAdminRouteAvailable,
  resolveStudioAdminActiveRouteId,
  resolveStudioModuleId,
  resolveStudioScreenId,
  STUDIO_ADMIN_ROUTE_REGISTRY,
} from '../../studioAdminRouteModel';

const COMPACT_VISIBILITY = { base: true, lg: false } as const;

export interface AnkhAdminShellProps {
  readonly children?: React.ReactNode;
}

export function AnkhAdminShell({ children }: AnkhAdminShellProps) {
  const studio = useStudio();
  const pathname = usePathname();
  const router = useRouter();
  const { theme } = useZoraTheme();
  const [drawerOpen, setDrawerOpen] = useState(false);
  const activeRouteId = resolveStudioAdminActiveRouteId(pathname);
  const contextualScreenId = resolveStudioScreenId(pathname) ?? studio.activeScreenId;
  const contextualModuleId = resolveStudioModuleId(pathname);
  const activeDefinition = getStudioAdminRouteDefinition(activeRouteId);

  const openRoute = (routeId: StudioAdminRouteId) => {
    const path = createStudioAdminRoutePath({
      routeId,
      selectedNodeId: studio.selectedNodeId,
      screenId: contextualScreenId,
      moduleId: contextualModuleId,
    });
    if (!path) return;

    studio.setActiveAdminRouteId(routeId);
    router.push(path);
    setDrawerOpen(false);
  };

  const goBackToApp = () => {
    router.replace(studio.lastNonAdminLocation || '/');
  };

  const nav = (
    <AdminNavigation
      activeRouteId={activeRouteId}
      selectedNodeId={studio.selectedNodeId}
      screenId={contextualScreenId}
      moduleId={contextualModuleId}
      onRoutePress={openRoute}
    />
  );

  const content = <View style={styles.contentOnly}>{children ?? <Slot />}</View>;

  return (
    <SafeAreaView style={[styles.shell, { backgroundColor: theme.colors.background }]}>
      <AppBar
        title={activeDefinition.label}
        subtitle={activeDefinition.description}
        leading={
          <IconButton
            icon={{ name: 'arrow-back-outline' }}
            label="Back to app"
            variant="ghost"
            color="neutral"
            onPress={goBackToApp}
          />
        }
        actions={
          <Show when={COMPACT_VISIBILITY}>
            <IconButton
              icon={{ name: 'menu-outline' }}
              label="Open administration navigation"
              variant="ghost"
              color="neutral"
              onPress={() => setDrawerOpen(true)}
            />
          </Show>
        }
      />
      <Show when={COMPACT_VISIBILITY}>
        <Drawer
          visible={drawerOpen}
          position="left"
          title="Administration"
          closeOnBackdrop
          onDismiss={() => setDrawerOpen(false)}
        >
          {nav}
        </Drawer>
      </Show>
      <View style={styles.body}>
        <Show
          when={COMPACT_VISIBILITY}
          fallback={
            <SidebarLayout sidebar={nav} sidebarWidth={260} sizing="fill">
              {content}
            </SidebarLayout>
          }
        >
          {content}
        </Show>
      </View>
    </SafeAreaView>
  );
}

function AdminNavigation(props: {
  readonly activeRouteId: StudioAdminRouteId;
  readonly selectedNodeId: string | null;
  readonly screenId: string | null;
  readonly moduleId: string | null;
  readonly onRoutePress: (routeId: StudioAdminRouteId) => void;
}) {
  const { theme } = useZoraTheme();

  return (
    <ScrollView contentContainerStyle={styles.navigationContent}>
      <Text color="neutral" emphasis="muted" variant="caption">
        Administration
      </Text>
      {STUDIO_ADMIN_ROUTE_REGISTRY.filter((route) => route.showInNavigation !== false).map(
        (route) => {
          const available = isStudioAdminRouteAvailable(route.id, {
            selectedNodeId: props.selectedNodeId,
            screenId: props.screenId,
            moduleId: props.moduleId,
          });
          const active = isStudioAdminRouteActive({
            currentRouteId: props.activeRouteId,
            candidateRouteId: route.id,
          });
          const exact = props.activeRouteId === route.id;

          return (
            <Pressable
              key={route.id}
              accessibilityLabel={`${route.label} administration`}
              accessibilityRole="button"
              disabled={!available}
              onPress={() => props.onRoutePress(route.id)}
              style={[
                styles.navigationItem,
                route.parentId ? styles.navigationChildItem : null,
                {
                  backgroundColor: active ? theme.colors.surface : 'transparent',
                  borderColor: exact ? theme.colors.primary : theme.colors.border,
                  opacity: available ? 1 : 0.45,
                },
              ]}
              testID={`ankh-admin-nav-${route.id}`}
            >
              <Text color={active ? 'primary' : 'neutral'} weight={active ? 'semiBold' : 'regular'}>
                {route.label}
              </Text>
            </Pressable>
          );
        },
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  shell: {
    flex: 1,
  },
  body: {
    flex: 1,
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  contentOnly: {
    flex: 1,
    minHeight: 0,
  },
  navigationContent: {
    gap: 8,
    paddingVertical: 4,
  },
  navigationItem: {
    minHeight: 42,
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    justifyContent: 'center',
  },
  navigationChildItem: {
    marginLeft: 18,
  },
});
