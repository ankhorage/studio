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
  expect(source).toContain('credentialsRef');
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
  expect(source).toContain('updateAuthSettings(nextDraft)');
  expect(source).toContain('await flushManifest()');
  expect(source).toContain('readStudioAuthSettings(canonicalManifestRef.current)');
  expect(source).toContain('mutateAuthSettings');
  expect(source).not.toContain('getProjectAuthSettings');
});

test('credential saves preserve unrelated draft edits instead of reloading settings', () => {
  expect(source).toContain('persistStoredOAuthCredentialLinkAndPatchLocalDraft');
  expect(source).toContain('persistCredentialLinkAndPatchDraft');
  expect(source).toContain('initializedDraftFromManifestRef');
  expect(source).toContain('canonicalManifestRef');
  expect(source).not.toContain('void persistCredentialLink');
  expect(source).not.toContain(`useEffect(() => {
    setDraft`);
  expect(source).not.toContain('const nextDraft = { ...draft, oauth: nextOAuth };');
  expect(source).not.toContain('onSaved={(nextMessage)');
});

test('credential saves serialize the full provider transaction', () => {
  expect(source).toContain('OAuthCredentialTransactionCoordinator');
  expect(source).toContain('runCredentialTransaction');
  expect(source).toContain('await props.onSaved');
  expect(source).toContain('loading={savingCredentials || props.transactionBusy}');
  expect(source).toContain('busyCredentialProviderIds.has(providerId)');
});

test('auth provider enablement uses credential completeness instead of status or ref alone', () => {
  expect(source).toContain('const credentialsComplete =');
  expect(source).toContain('Boolean(current?.credentialsRef)');
  expect(source).toContain('requiredFields.every');
  expect(source).not.toContain("props.providerHealth?.status === 'configured'");
});
