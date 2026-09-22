import type { AppCategory } from '@ankhorage/contracts';
import { composeCategoryAppManifest } from '@ankhorage/templates';

import type { ProjectCreationSource } from './projectCreationSource';

/*** Create one minimal deterministic project source for host acceptance scenarios that do not exercise template catalog content. */
export function createMinimalProjectSource(
  category: AppCategory = 'developer_tools',
): ProjectCreationSource {
  const { manifest } = composeCategoryAppManifest({
    category,
    name: 'Studio Smoke Fixture',
    slug: 'studio-smoke-fixture',
    navigator: {
      type: 'stack',
      initialRouteName: 'index',
      routes: [{ name: 'index', path: '', screenId: 'home' }],
    },
    screens: {
      home: {
        id: 'home',
        name: 'Home',
        root: {
          id: 'home-screen',
          type: 'Screen',
          props: {},
        },
      },
    },
  });
  return { manifest, assets: [] };
}
