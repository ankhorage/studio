import { expect, test } from 'bun:test';

import { ProjectDeployService, registerProjectDeployRoutes } from '../index';

test('host entrypoint intentionally exports the shared Studio Deploy host surface', () => {
  expect(typeof ProjectDeployService).toBe('function');
  expect(typeof registerProjectDeployRoutes).toBe('function');
});
