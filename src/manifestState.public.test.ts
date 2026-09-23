import { expect, test } from 'bun:test';

import type {
  ScreenRouteEntry,
  ScreenRouteGroup,
  StudioScreenNavigationDiagnostic,
  StudioScreenNavigationDiagnosticCode,
  StudioScreenNavigationEntry,
  StudioScreenNavigationModel,
  StudioScreenRouteReference,
} from './manifestState';
import {
  collectScreenRouteEntries,
  createDefaultThemeConfig,
  DEFAULT_STUDIO_SCREEN_TEMPLATE,
  deleteStudioManifestTheme,
  deriveStudioScreenNavigationModel,
  findNavigatorAtPath,
  findNodeInManifest,
  findParentPathForScreenId,
  findRoutesAtParentPath,
  generateManifestStateId,
  getPrimaryNavigatorPath,
  groupScreenRouteEntries,
  hasCanonicalStudioScreenRegistryIdentity,
  insertRouteAtParentPath,
  isRouteGroupSegment,
  makeUniqueRouteNameForParent,
  makeUniqueSiblingRouteName,
  moveStudioManifestRoute,
  pathToKey,
  removeScreenIdFromRoutes,
  resolveInitialScreenId,
  resolveStudioScreenAppPath,
  setStudioManifestActiveThemeId,
  setStudioManifestActiveThemeMode,
  setStudioManifestRoutePrimaryNavigationVisibility,
  toCanonicalRoutePattern,
  updateNavigatorAtPath,
  updateStudioManifestDataBindings,
  updateStudioManifestDataSources,
} from './manifestState';

const PUBLIC_MANIFEST_STATE_VALUES = [
  collectScreenRouteEntries,
  createDefaultThemeConfig,
  DEFAULT_STUDIO_SCREEN_TEMPLATE,
  deleteStudioManifestTheme,
  deriveStudioScreenNavigationModel,
  findNavigatorAtPath,
  findNodeInManifest,
  findParentPathForScreenId,
  findRoutesAtParentPath,
  generateManifestStateId,
  getPrimaryNavigatorPath,
  groupScreenRouteEntries,
  hasCanonicalStudioScreenRegistryIdentity,
  insertRouteAtParentPath,
  isRouteGroupSegment,
  makeUniqueRouteNameForParent,
  makeUniqueSiblingRouteName,
  moveStudioManifestRoute,
  pathToKey,
  removeScreenIdFromRoutes,
  resolveInitialScreenId,
  resolveStudioScreenAppPath,
  setStudioManifestActiveThemeId,
  setStudioManifestActiveThemeMode,
  setStudioManifestRoutePrimaryNavigationVisibility,
  toCanonicalRoutePattern,
  updateNavigatorAtPath,
  updateStudioManifestDataBindings,
  updateStudioManifestDataSources,
] as const;

type PublicManifestStateTypes = readonly [
  ScreenRouteEntry,
  ScreenRouteGroup,
  StudioScreenNavigationDiagnostic,
  StudioScreenNavigationDiagnosticCode,
  StudioScreenNavigationEntry,
  StudioScreenNavigationModel,
  StudioScreenRouteReference,
];

test('keeps the manifest-state public surface reachable without replaying owner behavior', () => {
  for (const exportedValue of PUBLIC_MANIFEST_STATE_VALUES) {
    expect(exportedValue).toBeDefined();
  }

  const exportedTypes: PublicManifestStateTypes | null = null;
  expect(exportedTypes).toBeNull();
});
