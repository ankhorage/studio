import { AppBar, Drawer, IconButton, SidebarLayout, Text, useZoraTheme } from '@ankhorage/zora';
import { Slot, usePathname, useRouter } from 'expo-router';
import React, { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, useWindowDimensions, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { useStudio } from '../../core/StudioContext';
import type { StudioAdminRouteId } from '../../index';
import {
  createStudioAdminRoutePath,
  getStudioAdminRouteDefinition,
  isStudioAdminRouteActive,
  isStudioAdminRouteAvailable,
  resolveStudioAdminActiveRouteId,
  STUDIO_ADMIN_ROUTE_REGISTRY,
} from '../../studioAdminRouteModel';

export interface AnkhAdminShellProps {
  readonly children?: React.ReactNode;
}

export function AnkhAdminShell({ children }: AnkhAdminShellProps) {
  const studio = useStudio();
  const pathname = usePathname();
  const router = useRouter();
  const { width } = useWindowDimensions();
  const { theme } = useZoraTheme();
  const [drawerOpen, setDrawerOpen] = useState(false);
  const activeRouteId = resolveStudioAdminActiveRouteId(pathname);
  const activeDefinition = getStudioAdminRouteDefinition(activeRouteId);
  const compact = width < 900;

  const openRoute = (routeId: StudioAdminRouteId) => {
    const path = createStudioAdminRoutePath({
      routeId,
      selectedNodeId: studio.selectedNodeId,
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
      onRoutePress={openRoute}
    />
  );

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
          compact ? (
            <IconButton
              icon={{ name: 'menu-outline' }}
              label="Open administration navigation"
              variant="ghost"
              color="neutral"
              onPress={() => setDrawerOpen(true)}
            />
          ) : null
        }
      />
      {compact ? (
        <Drawer
          visible={drawerOpen}
          position="left"
          title="Administration"
          closeOnBackdrop
          onDismiss={() => setDrawerOpen(false)}
        >
          {nav}
        </Drawer>
      ) : null}
      <View style={styles.body}>
        {compact ? (
          <View style={styles.contentOnly}>{children ?? <Slot />}</View>
        ) : (
          <SidebarLayout sidebar={nav} sidebarWidth={260}>
            <View style={styles.contentOnly}>{children ?? <Slot />}</View>
          </SidebarLayout>
        )}
      </View>
    </SafeAreaView>
  );
}

function AdminNavigation(props: {
  readonly activeRouteId: StudioAdminRouteId;
  readonly selectedNodeId: string | null;
  readonly onRoutePress: (routeId: StudioAdminRouteId) => void;
}) {
  const { theme } = useZoraTheme();

  return (
    <ScrollView contentContainerStyle={styles.navigationContent}>
      <Text color="neutral" emphasis="muted" variant="caption">
        Administration
      </Text>
      {STUDIO_ADMIN_ROUTE_REGISTRY.map((route) => {
        const available = isStudioAdminRouteAvailable(route.id, {
          selectedNodeId: props.selectedNodeId,
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
      })}
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
