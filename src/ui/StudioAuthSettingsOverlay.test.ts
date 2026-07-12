import { expect, test } from 'bun:test';
import { readFileSync } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const source = readFileSync(
  path.join(path.dirname(fileURLToPath(import.meta.url)), 'StudioAuthSettingsOverlay.tsx'),
  'utf8',
);

test('auth settings keeps provider-specific OAuth credential orchestration', () => {
  expect(source).toContain('configureProjectOAuthProvider');
  expect(source).toContain('definition.secretFields.map');
  expect(source).toContain("state: 'secret_saved_manifest_failed'");
  expect(source).toContain('Retry manifest link');
});

test('auth provider enablement uses health status instead of credentialsRef alone', () => {
  expect(source).toContain("props.providerHealth?.status === 'configured'");
  expect(source).not.toContain('Boolean(current?.credentialsRef)');
});
