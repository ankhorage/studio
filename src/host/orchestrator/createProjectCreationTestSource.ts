import type { AppCategory } from '@ankhorage/contracts';
import { composeCategoryAppManifest } from '@ankhorage/templates';

import type { ProjectCreationSource } from './projectCreationSource';

/*** Create the minimal project source shared by ProjectManager unit tests without depending on smoke fixtures. */
export function createProjectCreationTestSource(
  category: AppCategory = 'developer_tools',
): ProjectCreationSource {
  const { manifest } = composeCategoryAppManifest({
    category,
    name: 'Studio Project Fixture',
    slug: 'studio-project-fixture',
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
