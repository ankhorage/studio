import { expect, test } from 'bun:test';

import {
  collectScreenRouteEntries as collectFromManifestState,
  findNavigatorAtPath as findNavigatorFromManifestState,
  pathToKey as pathToKeyFromManifestState,
} from './manifestState';
import { collectScreenRouteEntries, findNavigatorAtPath, pathToKey } from './routeUtils';

test('re-exports canonical route utilities from the manifest-state public facade', () => {
  expect(collectFromManifestState).toBe(collectScreenRouteEntries);
  expect(findNavigatorFromManifestState).toBe(findNavigatorAtPath);
  expect(pathToKeyFromManifestState).toBe(pathToKey);
});
