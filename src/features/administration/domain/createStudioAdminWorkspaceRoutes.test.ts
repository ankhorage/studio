import { expect, test } from 'bun:test';

import { STUDIO_ADMIN_ROUTE_REGISTRY } from '../../../studioAdminRouteModel';
import { createStudioAdminWorkspaceRoutes } from './createStudioAdminWorkspaceRoutes';

test('projects every canonical route once with its Studio-owned hierarchy', () => {
  const routes = createStudioAdminWorkspaceRoutes({
    selectedNodeId: null,
    screenId: null,
    moduleId: null,
  });

  expect(routes.map((route) => route.id)).toEqual(
    STUDIO_ADMIN_ROUTE_REGISTRY.map((route) => route.id),
  );
  expect(routes).toHaveLength(25);
  expect(routes.find((route) => route.id === 'api-catalog')).toMatchObject({
    parentId: 'apis',
    href: '/ankh/apis/catalog',
  });
  expect(routes.find((route) => route.id === 'theme-colors')).toMatchObject({
    parentId: 'theme',
    href: '/ankh/theme/colors',
  });
  for (const id of ['screen-detail', 'module-detail', 'theme-component', 'theme-pattern']) {
    expect(routes.find((route) => route.id === id)?.visible).toBe(false);
  }
  expect(routes.find((route) => route.id === 'bindings')).toMatchObject({
    visible: true,
    href: null,
  });
  expect(routes.find((route) => route.id === 'properties')).toMatchObject({
    visible: true,
    href: null,
  });
});

test('resolves selected contexts through Studio route builders without changing route shape', () => {
  const routes = createStudioAdminWorkspaceRoutes({
    selectedNodeId: 'node / 1',
    screenId: 'screen / 2',
    moduleId: 'vendor/module',
  });

  expect(routes.find((route) => route.id === 'bindings')?.href).toBe(
    '/ankh/bindings/node%20%2F%201',
  );
  expect(routes.find((route) => route.id === 'properties')?.href).toBe(
    '/ankh/properties/node%20%2F%201',
  );
  expect(routes.find((route) => route.id === 'screen-detail')?.href).toBe(
    '/ankh/screens/screen%20%2F%202',
  );
  expect(routes.find((route) => route.id === 'module-detail')?.href).toBe(
    '/ankh/modules/vendor%2Fmodule',
  );
});
