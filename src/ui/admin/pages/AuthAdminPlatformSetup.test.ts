import { expect, test } from 'bun:test';
import { readFileSync } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const source = readFileSync(
  path.join(path.dirname(fileURLToPath(import.meta.url)), 'AuthAdminPage.tsx'),
  'utf8',
);

test('auth administration uses canonical environments and adapter-owned setup requirements', () => {
  expect(source).toContain('APP_DEPLOY_ENVIRONMENT_IDS.map');
  expect(source).toContain('getProjectAuthHealth({ projectId, environment })');
  expect(source).toContain('environment: props.environment');
  expect(source).toContain("field.sensitivity === 'secret'");
  expect(source).toContain('callbackRequirements.map');
  expect(source).not.toContain("environment: 'local'");
});
