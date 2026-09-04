import { NAVIGATOR_TYPES, type NavigatorType } from '@ankhorage/contracts';
import {
  Button,
  ButtonGroup,
  Card,
  ConfirmDialog,
  Input,
  ListRow,
  ListSection,
  Select,
  SwitchField,
  Text,
} from '@ankhorage/zora';
import React, { useMemo, useState } from 'react';
import { useRouter } from 'expo-router';
import { StyleSheet, View } from 'react-native';

import { useStudio } from '../../../core/StudioContext';
import {
  deriveStudioScreenNavigationModel,
  findNavigatorAtPath,
  type StudioScreenNavigationEntry,
  type StudioScreenRouteReference,
} from '../../../manifestState';
import { createStudioScreenRoutePath } from '../../../studioAdminRouteModel';
import { AdminHeader, AdminScroll } from '../adminPagePrimitives';
import { applyScreensAdminAction } from './screens/screensAdminActions';

const NAVIGATOR_OPTIONS = NAVIGATOR_TYPES.map((value) => ({
  value,
  label: value[0]?.toUpperCase() + value.slice(1),
})) satisfies readonly { value: NavigatorType; label: string }[];

interface PendingScreenDelete {
  screenId: string;
  label: string;
}

/*** Render canonical screens and primary-navigation authoring controls from the derived Studio screen navigation model. */
export function ScreensAdminPage() {
  const studio = useStudio();
  const router = useRouter();
  const [newScreenName, setNewScreenName] = useState('');
  const [pendingDelete, setPendingDelete] = useState<PendingScreenDelete | null>(null);
  const model = useMemo(
    () => (studio.manifest ? deriveStudioScreenNavigationModel(studio.manifest) : null),
    [studio.manifest],
  );
  /*** Dispatch one typed screens-admin action against the current Studio mutation target. */
  const dispatch = (action: Parameters<typeof applyScreensAdminAction>[1]) =>
    applyScreensAdminAction(studio, action);

  /*** Trim and create the requested screen, then clear the creation draft. */
  const createScreen = () => {
    const name = newScreenName.trim();
    if (!name) return;
    dispatch({ type: 'create-screen', name });
    setNewScreenName('');
  };

  /*** Apply the pending destructive screen deletion after confirmation. */
  const confirmDelete = () => {
    if (!pendingDelete) return;
    dispatch({ type: 'delete-screen', screenId: pendingDelete.screenId });
    setPendingDelete(null);
  };

  if (!studio.manifest || !model) {
    return (
      <AdminScroll>
        <AdminHeader
          title="Screens"
          description="Screens and primary app navigation are unavailable until the manifest loads."
        />
      </AdminScroll>
    );
  }
  const manifest = studio.manifest;

  return (
    <>
      <AdminScroll>
        <AdminHeader
          title="Screens"
          description="Manage canonical screens and how direct routes participate in primary app navigation."
        />

        <Card
          title="Primary navigator"
          description="Changes preserve the existing nested route tree."
        >
          <View style={styles.field}>
            <Text variant="bodySmall" weight="semiBold">
              Navigator type
            </Text>
            <Select
              value={model.primaryNavigator.type}
              options={NAVIGATOR_OPTIONS}
              onValueChange={(navigatorType) =>
                dispatch({ type: 'set-navigator-type', navigatorType })
              }
            />
          </View>
          <Text color="neutral" emphasis="muted" variant="caption">
            Primary navigator path: {formatParentPath(model.primaryNavigatorPath)}
          </Text>
        </Card>

        <Card title="Create screen" description="New screens are routed in the primary navigator.">
          <View style={styles.createRow}>
            <View style={styles.createInput}>
              <Input
                accessibilityLabel="New screen name"
                placeholder="Screen name"
                value={newScreenName}
                onChangeText={setNewScreenName}
                onSubmitEditing={createScreen}
              />
            </View>
            <Button disabled={!newScreenName.trim()} onPress={createScreen}>
              Create screen
            </Button>
          </View>
        </Card>

        {model.diagnostics.length > 0 ? (
          <ListSection
            title="Navigation diagnostics"
            description="Resolve these manifest states before relying on ambiguous route mutations."
          >
            {model.diagnostics.map((diagnostic, index) => (
              <ListRow
                key={`${diagnostic.code}:${diagnostic.routeName ?? diagnostic.screenId ?? index}`}
                title={diagnostic.code}
                description={diagnostic.message}
                meta={formatParentPath(diagnostic.parentPath)}
                variant="card"
              />
            ))}
          </ListSection>
        ) : null}

        <ListSection
          title="Screens"
          description={`${model.screens.length} canonical screen${model.screens.length === 1 ? '' : 's'}. Route existence and primary-navigation visibility are separate.`}
        >
          {model.screens.map((entry, index) => (
            <ScreenOverviewRow
              key={`${entry.screenId}:${index}`}
              entry={entry}
              screenCount={model.screens.length}
              manifest={manifest}
              dispatch={dispatch}
              onOpenDetail={(screenId) => router.push(createStudioScreenRoutePath(screenId))}
              onRequestDelete={setPendingDelete}
            />
          ))}
        </ListSection>
      </AdminScroll>

      <ConfirmDialog
        visible={pendingDelete !== null}
        title="Delete screen?"
        description={
          pendingDelete
            ? `Delete ${pendingDelete.label}, all of its route references, and bindings owned by its node tree?`
            : undefined
        }
        confirmLabel="Delete screen"
        confirmColor="danger"
        onCancel={() => setPendingDelete(null)}
        onConfirm={confirmDelete}
      />
    </>
  );
}

/*** Render one canonical screen with route references, detail navigation, and guarded deletion. */
function ScreenOverviewRow(props: {
  entry: StudioScreenNavigationEntry;
  screenCount: number;
  manifest: NonNullable<ReturnType<typeof useStudio>['manifest']>;
  dispatch: (action: Parameters<typeof applyScreensAdminAction>[1]) => void;
  onOpenDetail: (screenId: string) => void;
  onRequestDelete: (pending: PendingScreenDelete) => void;
}) {
  const { entry } = props;
  const label = entry.screen.title ?? entry.screen.name;
  const canDelete = props.screenCount > 1;

  return (
    <ListRow
      title={label}
      meta={entry.screenId}
      variant="card"
      action={
        <ButtonGroup orientation="responsive" align="end">
          <Button variant="outline" onPress={() => props.onOpenDetail(entry.screenId)}>
            Details
          </Button>
          <Button
            color="danger"
            variant="ghost"
            disabled={!canDelete}
            onPress={() => props.onRequestDelete({ screenId: entry.screenId, label })}
          >
            Delete
          </Button>
        </ButtonGroup>
      }
      description={
        <View style={styles.screenDetails}>
          {entry.screen.name !== label ? (
            <Text color="neutral" variant="bodySmall">
              Name: {entry.screen.name}
            </Text>
          ) : null}
          {!canDelete ? (
            <Text color="neutral" emphasis="muted" variant="caption">
              The final remaining screen cannot be deleted.
            </Text>
          ) : null}
          {entry.routeReferences.length === 0 ? (
            <Text color="neutral" emphasis="muted" variant="bodySmall">
              Unrouted screen
            </Text>
          ) : (
            entry.routeReferences.map((reference) => (
              <ScreenRouteReferenceControls
                key={`${formatParentPath(reference.parentPath)}:${reference.route.name}`}
                reference={reference}
                siblingCount={
                  findNavigatorAtPath(props.manifest.navigator, reference.parentPath)?.routes
                    .length ?? 0
                }
                dispatch={props.dispatch}
              />
            ))
          )}
        </View>
      }
    />
  );
}

/*** Render primary-navigation visibility, initial-route, and sibling-order controls for one screen route reference. */
function ScreenRouteReferenceControls(props: {
  reference: StudioScreenRouteReference;
  siblingCount: number;
  dispatch: (action: Parameters<typeof applyScreensAdminAction>[1]) => void;
}) {
  const { reference } = props;
  const routeContext = `${formatParentPath(reference.parentPath)} · ${reference.navigatorType}`;

  return (
    <Card compact title={reference.route.label ?? reference.route.name} description={routeContext}>
      <View style={styles.routeFacts}>
        <Text color="neutral" variant="bodySmall">
          Path: {reference.pathnamePattern}
        </Text>
        <Text color="neutral" variant="bodySmall">
          Route key: {reference.route.name} · Order {reference.siblingIndex + 1}
        </Text>
      </View>

      {reference.isPrimaryNavigatorMember ? (
        <>
          <SwitchField
            label="Visible in primary navigation"
            description="Hidden routes remain valid and programmatically navigable."
            value={reference.showInPrimaryNavigation}
            onValueChange={(showInPrimaryNavigation) =>
              props.dispatch({
                type: 'set-primary-navigation-visibility',
                parentPath: reference.parentPath,
                routeName: reference.route.name,
                showInPrimaryNavigation,
              })
            }
          />
          <ButtonGroup orientation="responsive" align="start">
            <Button
              variant="outline"
              disabled={reference.isPrimaryInitialRoute}
              onPress={() =>
                props.dispatch({
                  type: 'set-initial-route',
                  routeName: reference.route.name,
                })
              }
            >
              {reference.isPrimaryInitialRoute ? 'Initial route' : 'Set as initial'}
            </Button>
            <Button
              color="neutral"
              variant="ghost"
              disabled={reference.siblingIndex === 0}
              onPress={() =>
                props.dispatch({
                  type: 'move-route',
                  parentPath: reference.parentPath,
                  routeName: reference.route.name,
                  toIndex: reference.siblingIndex - 1,
                })
              }
            >
              Move up
            </Button>
            <Button
              color="neutral"
              variant="ghost"
              disabled={reference.siblingIndex >= props.siblingCount - 1}
              onPress={() =>
                props.dispatch({
                  type: 'move-route',
                  parentPath: reference.parentPath,
                  routeName: reference.route.name,
                  toIndex: reference.siblingIndex + 1,
                })
              }
            >
              Move down
            </Button>
          </ButtonGroup>
        </>
      ) : (
        <Text color="neutral" emphasis="muted" variant="caption">
          Nested route reference. ADM 8 does not provide arbitrary nested navigator editing.
        </Text>
      )}
    </Card>
  );
}

/***
 * Format a route parent-path segment array as a slash-delimited display label with a root fallback.
 * @utility @ankhorage/utility/route
 */
function formatParentPath(parentPath: readonly string[]): string {
  return parentPath.length === 0 ? 'root' : parentPath.join('/');
}

const styles = StyleSheet.create({
  createRow: {
    alignItems: 'center',
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  createInput: {
    flexGrow: 1,
    minWidth: 220,
  },
  field: {
    gap: 8,
  },
  routeFacts: {
    gap: 4,
  },
  screenDetails: {
    gap: 10,
    paddingTop: 4,
  },
});
