import type { ThemeModeConfig, UiNode } from '@ankhorage/contracts';
import {
  AppBar,
  Card,
  Drawer,
  Heading,
  IconButton,
  SidebarLayout,
  Text,
  useZoraTheme,
} from '@ankhorage/zora';
import { Slot, usePathname, useRouter } from 'expo-router';
import React, { useState } from 'react';
import {
  Pressable,
  ScrollView,
  StyleSheet,
  TextInput,
  useWindowDimensions,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { useStudio } from '../core/StudioContext';
import type { StudioAdminRouteId, ThemeUpdates } from '../index';
import { findNodeInManifest, findScreenIdForNode } from '../manifestState';
import {
  createStudioAdminRoutePath,
  getStudioAdminRouteDefinition,
  isStudioAdminRouteActive,
  isStudioAdminRouteAvailable,
  resolveStudioAdminActiveRouteId,
  resolveStudioPropertiesNodeId,
  STUDIO_ADMIN_ROUTE_REGISTRY,
} from '../studioAdminRouteModel';
import { StudioSecretsPage } from './StudioAdminOverlay';
import { StudioAuthSettingsPage } from './StudioAuthSettingsOverlay';

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

export interface AnkhAdminPageProps {
  readonly routeId: StudioAdminRouteId;
}

export function AnkhAdminPage({ routeId }: AnkhAdminPageProps) {
  const studio = useStudio();
  const pathname = usePathname();

  if (routeId === 'auth' || routeId === 'auth-providers' || routeId === 'auth-routes') {
    return (
      <StudioAuthSettingsPage
        projectId={studio.projectId}
        manifest={studio.manifest}
        routeId={routeId}
      />
    );
  }

  if (routeId === 'auth-profile') {
    return (
      <StudioAuthSettingsPage
        projectId={studio.projectId}
        manifest={studio.manifest}
        routeId="auth-profile"
      />
    );
  }

  if (routeId === 'secrets') {
    return <StudioSecretsPage projectId={studio.projectId} />;
  }

  if (routeId === 'theme') {
    return <ThemeAdminPage />;
  }

  if (routeId === 'properties') {
    return <PropertiesAdminPage nodeId={resolveStudioPropertiesNodeId(pathname)} />;
  }

  if (routeId === 'apis' || routeId === 'api-data-sources' || routeId === 'api-operations') {
    return <ApisAdminPage routeId={routeId} />;
  }

  return <OverviewAdminPage />;
}

function OverviewAdminPage() {
  const studio = useStudio();
  const manifest = studio.manifest;
  const routes = manifest?.navigator.routes.length ?? 0;
  const screens = manifest ? Object.keys(manifest.screens).length : 0;
  const dataSources = manifest?.dataSources ? Object.keys(manifest.dataSources).length : 0;
  const authScope = manifest?.infra.auth?.scope ?? 'none';

  return (
    <AdminScroll>
      <AdminHeader
        title="Project overview"
        description="Current generated app administration status and quick access."
      />
      <View style={styles.grid}>
        <Metric title="Project" value={manifest?.metadata.name ?? studio.projectId} />
        <Metric title="Routes" value={String(routes)} />
        <Metric title="Screens" value={String(screens)} />
        <Metric title="Data sources" value={String(dataSources)} />
      </View>
      <Card title="Administration status">
        <KeyValue label="Project ID" value={studio.projectId} />
        <KeyValue label="Auth scope" value={authScope} />
        <KeyValue label="Active theme" value={manifest?.activeThemeId ?? 'none'} />
      </Card>
    </AdminScroll>
  );
}

function ApisAdminPage({
  routeId,
}: {
  readonly routeId: Extract<StudioAdminRouteId, 'apis' | 'api-data-sources' | 'api-operations'>;
}) {
  const studio = useStudio();
  const dataSources = Object.entries(studio.manifest?.dataSources ?? {});
  const operationRows = dataSources.flatMap(([sourceId, source]) =>
    Object.entries(readRecord(source).endpoints ?? {}).map(([operationId, operation]) => ({
      sourceId,
      operationId,
      kind: readString(readRecord(operation).kind) ?? 'operation',
    })),
  );
  const showSources = routeId === 'apis' || routeId === 'api-data-sources';
  const showOperations = routeId === 'apis' || routeId === 'api-operations';

  return (
    <AdminScroll>
      <AdminHeader
        title={
          routeId === 'api-operations'
            ? 'Operations'
            : routeId === 'api-data-sources'
              ? 'Data sources'
              : 'APIs'
        }
        description="Current data-source and runtime operation configuration from the Studio manifest."
      />
      {showSources ? (
        <Card title="Data sources">
          {dataSources.length > 0 ? (
            dataSources.map(([id, source]) => (
              <View key={id} style={styles.row}>
                <Text weight="semiBold">{id}</Text>
                <Text color="neutral" emphasis="muted" variant="bodySmall">
                  {readString(readRecord(source).kind) ?? 'data source'}
                </Text>
              </View>
            ))
          ) : (
            <Text color="neutral" emphasis="muted">
              No data sources are configured.
            </Text>
          )}
        </Card>
      ) : null}
      {showOperations ? (
        <Card title="Operations">
          {operationRows.length > 0 ? (
            operationRows.map((row) => (
              <View key={`${row.sourceId}:${row.operationId}`} style={styles.row}>
                <Text weight="semiBold">{row.operationId}</Text>
                <Text color="neutral" emphasis="muted" variant="bodySmall">
                  {row.sourceId} · {row.kind}
                </Text>
              </View>
            ))
          ) : (
            <Text color="neutral" emphasis="muted">
              No runtime operations are configured.
            </Text>
          )}
        </Card>
      ) : null}
    </AdminScroll>
  );
}

function ThemeAdminPage() {
  const studio = useStudio();
  const activeTheme =
    studio.manifest?.themes.find((theme) => theme.id === studio.manifest?.activeThemeId) ??
    studio.manifest?.themes[0] ??
    null;
  const mode = studio.manifest?.activeThemeMode ?? studio.studioMode;
  const modeConfig = activeTheme?.[mode] ?? null;
  const updateActiveTheme = (updates: ThemeUpdates) => {
    if (!activeTheme) return;
    studio.updateTheme(activeTheme.id, updates);
  };

  return (
    <AdminScroll>
      <AdminHeader
        title="Theme"
        description="Edit the canonical active theme for the currently active theme mode."
      />
      {activeTheme && modeConfig ? (
        <Card title={activeTheme.name}>
          <Field label="Theme name">
            <Input value={activeTheme.name} onChangeText={(name) => updateActiveTheme({ name })} />
          </Field>
          <Field label="Primary color">
            <Input
              value={modeConfig.primaryColor}
              autoCapitalize="none"
              onChangeText={(primaryColor) =>
                updateActiveTheme({ [mode]: { primaryColor } } as ThemeUpdates)
              }
            />
          </Field>
          <Field label="Harmony">
            <Input
              value={modeConfig.harmony}
              autoCapitalize="none"
              onChangeText={(harmony) =>
                updateActiveTheme({
                  [mode]: { harmony: harmony as ThemeModeConfig['harmony'] },
                } as ThemeUpdates)
              }
            />
          </Field>
        </Card>
      ) : (
        <Card title="Theme unavailable">
          <Text color="neutral" emphasis="muted">
            No theme is configured in the current Studio manifest.
          </Text>
        </Card>
      )}
    </AdminScroll>
  );
}

function PropertiesAdminPage({ nodeId }: { readonly nodeId: string | null }) {
  const studio = useStudio();
  const owningScreenId =
    nodeId && studio.manifest ? findScreenIdForNode(studio.manifest, nodeId) : null;
  const owningRoot = owningScreenId ? studio.manifest?.screens[owningScreenId]?.root : null;
  const node = owningRoot && nodeId ? findNodeInManifest(owningRoot, nodeId) : null;

  React.useEffect(() => {
    if (nodeId && node && owningScreenId) {
      studio.setActiveScreenId(owningScreenId);
      studio.selectNode(nodeId);
    }
  }, [node, nodeId, owningScreenId, studio]);

  return (
    <AdminScroll>
      <AdminHeader
        title="Properties"
        description="Contextual properties for the selected Studio node."
      />
      {node ? (
        <Card title={node.alias ?? node.type}>
          <KeyValue label="Node ID" value={node.id} />
          <KeyValue label="Type" value={node.type} />
          <Field label="Alias">
            <Input
              value={node.alias ?? ''}
              onChangeText={(alias) => studio.updateNode(node.id, { alias })}
            />
          </Field>
          <NodeProps node={node} />
        </Card>
      ) : (
        <Card title="Node unavailable">
          <Text color="neutral" emphasis="muted">
            The requested node could not be resolved in the active Studio screen.
          </Text>
        </Card>
      )}
    </AdminScroll>
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

function NodeProps({ node }: { readonly node: UiNode }) {
  const entries = Object.entries(node.props ?? {});
  if (entries.length === 0) {
    return (
      <Text color="neutral" emphasis="muted">
        This node has no editable primitive props.
      </Text>
    );
  }

  return (
    <>
      {entries.map(([key, value]) => (
        <KeyValue key={key} label={key} value={formatPrimitive(value)} />
      ))}
    </>
  );
}

function AdminScroll({ children }: { readonly children: React.ReactNode }) {
  return <ScrollView contentContainerStyle={styles.content}>{children}</ScrollView>;
}

function AdminHeader(props: { readonly title: string; readonly description: string }) {
  return (
    <View style={styles.pageHeader}>
      <Heading level={2} text={props.title} />
      <Text color="neutral" emphasis="muted" variant="bodySmall">
        {props.description}
      </Text>
    </View>
  );
}

function Metric(props: { readonly title: string; readonly value: string }) {
  return (
    <Card compact title={props.title}>
      <Heading level={3}>{props.value}</Heading>
    </Card>
  );
}

function Field(props: { readonly label: string; readonly children: React.ReactNode }) {
  return (
    <View style={styles.field}>
      <Text variant="bodySmall" weight="semiBold">
        {props.label}
      </Text>
      {props.children}
    </View>
  );
}

function Input(props: React.ComponentProps<typeof TextInput>) {
  const { theme } = useZoraTheme();
  return (
    <TextInput
      {...props}
      placeholderTextColor={theme.colors.textMuted}
      style={[
        styles.input,
        {
          color: theme.colors.text,
          backgroundColor: theme.colors.background,
          borderColor: theme.colors.border,
        },
        props.style,
      ]}
    />
  );
}

function KeyValue(props: { readonly label: string; readonly value: string }) {
  return (
    <View style={styles.keyValue}>
      <Text color="neutral" emphasis="muted" variant="bodySmall">
        {props.label}
      </Text>
      <Text weight="semiBold">{props.value}</Text>
    </View>
  );
}

function readRecord(value: unknown): Record<string, unknown> {
  return typeof value === 'object' && value !== null ? (value as Record<string, unknown>) : {};
}

function readString(value: unknown): string | null {
  return typeof value === 'string' ? value : null;
}

function formatPrimitive(value: unknown): string {
  if (typeof value === 'string') return value;
  if (typeof value === 'number' || typeof value === 'boolean') return String(value);
  return JSON.stringify(value);
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
  content: {
    width: '100%',
    maxWidth: 1040,
    alignSelf: 'center',
    padding: 20,
    paddingBottom: 48,
    gap: 18,
  },
  pageHeader: {
    gap: 6,
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  row: {
    gap: 4,
    paddingVertical: 8,
  },
  field: {
    gap: 6,
  },
  input: {
    minHeight: 44,
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  keyValue: {
    gap: 4,
  },
});
