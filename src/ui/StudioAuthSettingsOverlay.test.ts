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
  expect(source).toContain('intendedOAuth');
  expect(source).toContain('authScope: props.authScope');
  expect(source).toContain('oauthEnabled: props.oauth.enabled');
  expect(source).toContain('Retry manifest link');
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
