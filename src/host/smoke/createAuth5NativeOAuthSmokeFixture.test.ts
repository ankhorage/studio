import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';

import { EXPO_PLATFORM } from '@ankhorage/expo-runtime/platform';
import { expect, test } from 'bun:test';

import { AUTH5_NATIVE_OAUTH_SMOKE } from './auth5NativeOAuthSmokeConfig.js';
import { createAuth5NativeOAuthSmokeFixture } from './createAuth5NativeOAuthSmokeFixture.js';

interface GeneratedPackageJson {
  readonly dependencies?: Record<string, string>;
  readonly scripts?: Record<string, string>;
}

interface GeneratedManifest {
  readonly deploy?: {
    readonly targets?: {
      readonly android?: { readonly scheme?: string };
      readonly ios?: { readonly scheme?: string };
    };
  };
  readonly infra?: {
    readonly auth?: {
      readonly oauth?: {
        readonly providers?: readonly { readonly id?: string; readonly credentialsRef?: string }[];
      };
    };
  };
}

test('prepares a secret-free real generated app for Auth 5 native smoke validation', async () => {
  const workspaceRoot = await mkdtemp(path.join(tmpdir(), 'ankh-auth5-native-smoke-'));
  try {
    const fixture = await createAuth5NativeOAuthSmokeFixture(workspaceRoot);
    const manifest = await readJson<GeneratedManifest>(fixture.projectRoot, 'ankh.config.json');
    const packageJson = await readJson<GeneratedPackageJson>(fixture.projectRoot, 'package.json');
    const appConfig = await readText(fixture.projectRoot, 'app.config.ts');
    const androidRun = await readText(fixture.projectRoot, 'scripts/ankh-android.ts');
    const authAdapter = await readText(fixture.projectRoot, 'src/auth/adapter.ts');
    const oauthRuntime = await readText(fixture.projectRoot, 'src/auth/oauth.ts');

    expect(fixture.projectId).toBe(AUTH5_NATIVE_OAUTH_SMOKE.projectId);
    expect(manifest.deploy?.targets?.android?.scheme).toBe(AUTH5_NATIVE_OAUTH_SMOKE.android.scheme);
    expect(manifest.deploy?.targets?.ios?.scheme).toBe(AUTH5_NATIVE_OAUTH_SMOKE.ios.scheme);
    expect(manifest.infra?.auth?.oauth?.providers).toEqual([
      expect.objectContaining({ id: 'google', credentialsRef: 'auth/oauth/google' }),
    ]);

    expect(packageJson.scripts?.android).toBe('bun scripts/ankh-android.ts');
    expect(packageJson.scripts?.ios).toBe('expo run:ios');
    expect(packageJson.dependencies?.['@ankhorage/expo-runtime']).toBe('^3.2.2');
    expect(packageJson.dependencies?.[EXPO_PLATFORM.packages.crypto.name]).toBe(
      EXPO_PLATFORM.packages.crypto.version,
    );
    expect(packageJson.dependencies?.[EXPO_PLATFORM.packages.webBrowser.name]).toBe(
      EXPO_PLATFORM.packages.webBrowser.version,
    );
    expect(packageJson.dependencies?.['@react-native-google-signin/google-signin']).toBeUndefined();
    expect(packageJson.dependencies?.['expo-apple-authentication']).toBeUndefined();

    expect(appConfig).toContain(`scheme: '${AUTH5_NATIVE_OAUTH_SMOKE.android.scheme}'`);
    expect(appConfig).toContain(`scheme: '${AUTH5_NATIVE_OAUTH_SMOKE.ios.scheme}'`);
    expect(androidRun).toContain("spawn('adb', ['track-devices', '-l']");
    expect(androidRun).toContain('transport.serial !== selectedSerial');
    expect(androidRun).toContain("'-s',\n          transport.serial,\n          'reverse'");
    expect(androidRun).toContain("['-s', serial, 'reverse', '--list']");
    expect(androidRun).not.toContain('EXPO_PUBLIC_SUPABASE_ANON_KEY');
    expect(authAdapter).toContain("import { getRandomBytes } from 'expo-crypto';");
    expect(authAdapter).toContain('oauthRandomBytes: getRandomBytes');
    expect(oauthRuntime).toContain('resolveExpoOAuthBrowserRuntimeReadiness()');
    expect(oauthRuntime).toContain('WebBrowser.openAuthSessionAsync(');
    expect(oauthRuntime).toContain('oauth.completeAuthorization({');
    expect(oauthRuntime).not.toContain('setSession(');
    expect(oauthRuntime).not.toContain('access_token');
    expect(JSON.stringify(manifest)).not.toContain('clientSecret');
    expect(JSON.stringify(manifest)).not.toContain('serviceRoleKey');
  } finally {
    await rm(workspaceRoot, { force: true, recursive: true });
  }
}, 45_000);

async function readText(projectRoot: string, relativePath: string): Promise<string> {
  return readFile(path.join(projectRoot, relativePath), 'utf8');
}

async function readJson<T>(projectRoot: string, relativePath: string): Promise<T> {
  return JSON.parse(await readText(projectRoot, relativePath)) as T;
}
