import { expect, test } from 'bun:test';
import { readFileSync } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const source = readFileSync(
  path.join(path.dirname(fileURLToPath(import.meta.url)), 'AuthAdminPage.tsx'),
  'utf8',
);

test('auth settings keeps provider-specific OAuth credential orchestration', () => {
  expect(source).toContain('configureProjectOAuthProvider');
  expect(source).toContain('definition.secretFields.map');
  expect(source).toContain("state: 'secret_saved_manifest_failed'");
  expect(source).toContain('intendedProvider');
  expect(source).toContain('Retry manifest link');
});

test('credential writes do not submit unsaved global auth or OAuth state', () => {
  expect(source).not.toContain('authScope: props.authScope');
  expect(source).not.toContain('oauthEnabled: props.oauth.enabled');
  expect(source).not.toContain('callbackRoute: props.oauth.callbackRoute');
});

test('partial-failure retry persists only the intended provider against current server state', () => {
  expect(source).toContain('const persisted = (await getProjectAuthSettings(projectId))');
  expect(source).toContain('partialFailure.intendedProvider');
  expect(source).toContain('persistedOAuth.providers');
  expect(source).toContain('setDraft((current) => {');
  expect(source).not.toContain('linkRecoverableOAuthCredentials');
});

test('credential saves preserve unrelated draft edits instead of reloading settings', () => {
  expect(source).toContain('void refreshHealth()');
  expect(source).toContain('mergeOAuthProviderCredentialsRef');
  expect(source).toContain('setDraft((current) => ({ ...current, oauth: nextOAuth }))');
  expect(source).not.toContain('onSaved={(nextMessage)');
});

test('auth provider enablement uses credential completeness instead of status or ref alone', () => {
  expect(source).toContain('const credentialsComplete =');
  expect(source).toContain('Boolean(current?.credentialsRef)');
  expect(source).toContain('requiredFields.every');
  expect(source).not.toContain("props.providerHealth?.status === 'configured'");
});
