import { Button, ButtonGroup, Card, ListRow, ListSection, Text } from '@ankhorage/zora';
import { useRouter } from 'expo-router';
import React, { useMemo } from 'react';
import { StyleSheet, View } from 'react-native';

import { useStudio } from '../../../core/StudioContext';
import {
  deriveStudioScreenNavigationModel,
  resolveStudioScreenAppPath,
  type StudioScreenNavigationEntry,
  type StudioScreenRouteReference,
} from '../../../manifestState';
import { createStudioAdminRoutePath } from '../../../studioAdminRouteModel';
import { AdminHeader, AdminScroll } from '../adminPagePrimitives';

export interface ScreenDetailAdminPageProps {
  readonly screenId: string | null;
}

/*** Render canonical screen metadata, route references, and guarded app-navigation actions for one stable screen id. */
export function ScreenDetailAdminPage({ screenId }: ScreenDetailAdminPageProps) {
  const studio = useStudio();
  const router = useRouter();
  const model = useMemo(
    () => (studio.manifest ? deriveStudioScreenNavigationModel(studio.manifest) : null),
    [studio.manifest],
  );
  const screensPath = createStudioAdminRoutePath({ routeId: 'screens' });

  /*** Navigate back to the Studio screens administration route when it can be resolved. */
  const openScreens = () => {
    if (screensPath) router.push(screensPath);
  };

  if (!screenId) {
    return (
      <AdminScroll>
        <AdminHeader
          title="Invalid screen route"
          description="This URL does not contain one valid encoded ScreenSpec.id."
        />
        <Button variant="outline" onPress={openScreens}>
          Back to Screens
        </Button>
      </AdminScroll>
    );
  }

  if (!model) {
    return (
      <AdminScroll>
        <AdminHeader
          title="Screen detail"
          description="Canonical screen metadata is unavailable until the manifest loads."
        />
        <Card compact title="Requested screen ID">
          <Text>{screenId}</Text>
        </Card>
      </AdminScroll>
    );
  }

  const matchingEntries = model.screens.filter((candidate) => candidate.screenId === screenId);
  if (matchingEntries.length > 1) {
    return (
      <AdminScroll>
        <AdminHeader
          title="Screen identity is ambiguous"
          description="Multiple screen registry entries use this stable ScreenSpec.id. Studio will not select one arbitrarily."
        />
        <Card compact title="Ambiguous stable screen ID">
          <Text>{screenId}</Text>
        </Card>
        <Button variant="outline" onPress={openScreens}>
          Back to Screens
        </Button>
      </AdminScroll>
    );
  }

  const [entry] = matchingEntries;
  if (!entry) {
    return (
      <AdminScroll>
        <AdminHeader
          title="Screen not found"
          description="The requested screen is missing or was deleted from the canonical manifest."
        />
        <Card compact title="Requested stable screen ID">
          <Text>{screenId}</Text>
        </Card>
        <Button variant="outline" onPress={openScreens}>
          Back to Screens
        </Button>
      </AdminScroll>
    );
  }

  const appPath = resolveStudioScreenAppPath(model, entry.screenId);
  const label = entry.screen.title ?? entry.screen.name;
  /*** Navigate from administration to the resolved unambiguous app pathname for this screen. */
  const openAppScreen = () => {
    if (appPath) router.replace(appPath);
  };

  return (
    <AdminScroll>
      <AdminHeader
        title={label}
        description="Canonical screen metadata and every manifest route reference for this stable screen ID."
      />

      <Card title="Screen metadata" description="Identity comes only from ScreenSpec.id.">
        <MetadataFact label="Stable screen ID" value={entry.screen.id} />
        <MetadataFact label="Name" value={entry.screen.name} />
        <MetadataFact label="Title" value={entry.screen.title ?? 'Not set'} />
        <MetadataFact label="Description" value={entry.screen.description ?? 'Not set'} />
      </Card>

      <ButtonGroup orientation="responsive" align="start">
        <Button variant="outline" onPress={openScreens}>
          Back to Screens
        </Button>
        {appPath ? <Button onPress={openAppScreen}>Open app screen</Button> : null}
      </ButtonGroup>

      {!appPath ? <AppPathUnavailable entry={entry} /> : null}

      <ListSection
        title="Route references"
        description={formatRouteReferenceSummary(entry.routeReferences.length)}
      >
        {entry.routeReferences.length === 0 ? (
          <ListRow
            title="Unrouted screen"
            description="This screen exists canonically but has no navigator route reference."
            variant="card"
          />
        ) : (
          entry.routeReferences.map((reference, index) => (
            <RouteReferenceRow
              key={`${formatRoutePath(reference.parentPath)}:${reference.route.name}:${index}`}
              reference={reference}
              index={index}
            />
          ))
        )}
      </ListSection>
    </AdminScroll>
  );
}

/*** Render one labeled screen/route metadata fact. */
function MetadataFact(props: { readonly label: string; readonly value: string }) {
  return (
    <View style={styles.fact}>
      <Text color="neutral" emphasis="muted" variant="caption">
        {props.label}
      </Text>
      <Text>{props.value}</Text>
    </View>
  );
}

/*** Explain why an otherwise valid screen cannot be opened as one concrete app pathname. */
function AppPathUnavailable({ entry }: { readonly entry: StudioScreenNavigationEntry }) {
  let description = 'This screen has no route reference, so there is no app pathname to open.';
  if (entry.routeReferences.length > 1) {
    description = `This screen has ${entry.routeReferences.length} route references. Studio will not choose one arbitrarily.`;
  } else if (entry.routeReferences.length === 1) {
    description =
      'The canonical route reference does not resolve to one concrete, unambiguous app pathname because it is dynamic or collides with another route pattern.';
  }

  return <Card compact title="Open app screen unavailable" description={description} />;
}

/*** Render canonical metadata for one navigator route reference to the selected screen. */
function RouteReferenceRow(props: {
  readonly reference: StudioScreenRouteReference;
  readonly index: number;
}) {
  const { reference } = props;
  const primaryVisibility = reference.isPrimaryNavigatorMember
    ? `${reference.showInPrimaryNavigation ? 'Visible' : 'Hidden'}${
        reference.navigatorType === 'stack' ? ' (Stack has no primary-navigation chrome)' : ''
      }`
    : 'Not applicable to this nested navigator reference';
  const initialRoute = reference.isPrimaryNavigatorMember
    ? reference.isPrimaryInitialRoute
      ? 'Yes'
      : 'No'
    : 'Not applicable outside the primary navigator';

  return (
    <ListRow
      title={reference.route.label ?? reference.route.name}
      meta={`Reference ${props.index + 1}`}
      variant="card"
      description={
        <View style={styles.referenceFacts}>
          <MetadataFact label="Route key" value={reference.route.name} />
          <MetadataFact
            label="Declared route path"
            value={reference.route.path ?? 'Derived from route key'}
          />
          <MetadataFact label="Canonical pathname/pattern" value={reference.pathnamePattern} />
          <MetadataFact label="Navigator parent" value={formatRoutePath(reference.parentPath)} />
          <MetadataFact label="Navigator type" value={reference.navigatorType} />
          <MetadataFact label="Sibling order" value={String(reference.siblingIndex + 1)} />
          <MetadataFact
            label="Primary navigator member"
            value={reference.isPrimaryNavigatorMember ? 'Yes' : 'No'}
          />
          <MetadataFact label="Primary-navigation visibility" value={primaryVisibility} />
          <MetadataFact label="Primary initial route" value={initialRoute} />
        </View>
      }
    />
  );
}

/*** Format the number of route references to one screen as administration summary text. */
function formatRouteReferenceSummary(count: number): string {
  if (count === 0) return 'No route references resolve to this screen.';
  if (count === 1) return 'One canonical route reference resolves to this screen.';
  return `${count} canonical route references resolve to this screen; each is shown separately.`;
}

/***
 * Format a route path segment array as a slash-delimited path label with a configurable root concept.
 * @utility @ankhorage/utility/route
 */
function formatRoutePath(routePath: readonly string[]): string {
  return routePath.length === 0 ? 'root' : routePath.join('/');
}

const styles = StyleSheet.create({
  fact: {
    gap: 2,
  },
  referenceFacts: {
    gap: 10,
    paddingTop: 4,
  },
});
