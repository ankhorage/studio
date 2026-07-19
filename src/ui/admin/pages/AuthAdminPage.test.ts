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
  expect(source).toContain('intendedProvider');
  expect(source).toContain('persistStoredOAuthCredentialLink');
  expect(source).toContain('setPendingCredentialLink(result.pendingLink)');
  expect(source).not.toContain("state: 'secret_saved_manifest_failed'");
  expect(source).toContain('Retry manifest link');
});

test('credential writes do not submit unsaved global auth or OAuth state', () => {
  expect(source).not.toContain('authScope:');
  expect(source).not.toContain('oauthEnabled:');
  expect(source).not.toContain('callbackRoute: props.oauth.callbackRoute');
  expect(source).not.toContain('saveProjectAuthSettings');
});

test('auth saves go through StudioProvider manifest state', () => {
  expect(source).toContain('studio.updateAuthSettings(nextDraft)');
  expect(source).toContain('await studio.flushManifest()');
  expect(source).toContain('readStudioAuthSettings(manifest');
  expect(source).not.toContain('getProjectAuthSettings');
});

test('credential saves preserve unrelated draft edits instead of reloading settings', () => {
  expect(source).toContain('void persistCredentialLink');
  expect(source).toContain('mergeOAuthProviderCredentialsRef');
  expect(source).toContain('const nextDraft = { ...draft, oauth: nextOAuth };');
  expect(source).not.toContain('onSaved={(nextMessage)');
});

test('auth provider enablement uses credential completeness instead of status or ref alone', () => {
  expect(source).toContain('const credentialsComplete =');
  expect(source).toContain('Boolean(current?.credentialsRef)');
  expect(source).toContain('requiredFields.every');
  expect(source).not.toContain("props.providerHealth?.status === 'configured'");
});
