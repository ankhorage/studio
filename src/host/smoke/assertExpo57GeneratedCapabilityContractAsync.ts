import { readdir, readFile } from 'node:fs/promises';
import path from 'node:path';

import { EXPO_PLATFORM } from '@ankhorage/expo-runtime/platform';

export async function assertExpo57GeneratedCapabilityContractAsync(
  projectRoot: string,
): Promise<void> {
  const packageJson = JSON.parse(
    await readFile(path.join(projectRoot, 'package.json'), 'utf8'),
  ) as GeneratedPackageJson;
  const dependencies = packageJson.dependencies ?? {};
  const expectedDependencies = [
    '@ankhorage/permissions',
    '@ankhorage/supabase-auth',
    EXPO_PLATFORM.packages.audio.name,
    EXPO_PLATFORM.packages.camera.name,
    EXPO_PLATFORM.packages.crypto.name,
    EXPO_PLATFORM.packages.location.name,
    EXPO_PLATFORM.packages.mediaLibrary.name,
    EXPO_PLATFORM.packages.notifications.name,
    EXPO_PLATFORM.packages.secureStore.name,
    EXPO_PLATFORM.packages.webBrowser.name,
  ];
  for (const dependency of expectedDependencies) {
    if (!Object.hasOwn(dependencies, dependency)) {
      throw new Error(`Generated capability fixture is missing dependency ${dependency}.`);
    }
  }
  for (const forbiddenDependency of ['expo-av', 'expo-permissions']) {
    if (Object.hasOwn(dependencies, forbiddenDependency)) {
      throw new Error(`Generated capability fixture declares ${forbiddenDependency}.`);
    }
  }
  await assertConfigAsync(projectRoot);
  await assertGeneratedRuntimesAsync(projectRoot);
  await assertNoObsoleteSourceAsync(projectRoot);
}

async function assertConfigAsync(projectRoot: string): Promise<void> {
  const appConfig = await readFile(path.join(projectRoot, 'app.config.ts'), 'utf8');
  for (const expected of [
    "scheme: 'ankh-expo57-capabilities-android'",
    "scheme: 'ankh-expo57-capabilities-ios'",
    `'${EXPO_PLATFORM.packages.audio.name}'`,
    `'${EXPO_PLATFORM.packages.camera.name}'`,
    `'${EXPO_PLATFORM.packages.location.name}'`,
    `'${EXPO_PLATFORM.packages.mediaLibrary.name}'`,
    `'${EXPO_PLATFORM.packages.notifications.name}'`,
    'barcodeScannerEnabled: true',
    'recordAudioAndroid: true',
    'isAndroidBackgroundLocationEnabled: true',
  ]) {
    if (!appConfig.includes(expected)) {
      throw new Error(`Generated capability app config is missing ${expected}.`);
    }
  }
}

async function assertGeneratedRuntimesAsync(projectRoot: string): Promise<void> {
  const rootLayout = await readFile(path.join(projectRoot, 'src', 'app', '_layout.tsx'), 'utf8');
  for (const expected of ['ExpoRuntimeProviders', 'APP_EXTENSION_COMPONENT_REGISTRY']) {
    if (!rootLayout.includes(expected)) {
      throw new Error(`Generated capability root layout is missing ${expected}.`);
    }
  }

  const scannerAdapter = await readFile(
    path.join(projectRoot, 'src', 'generated', 'expo', 'ExpoBarcodeScannerView.tsx'),
    'utf8',
  );
  if (
    !scannerAdapter.includes(
      "export { ExpoBarcodeScannerAdapter as ExpoBarcodeScannerView } from '@ankhorage/expo-runtime';",
    )
  ) {
    throw new Error('Generated scanner bridge does not consume the Expo Runtime adapter.');
  }

  const extensionRegistry = await readFile(
    path.join(projectRoot, 'src', 'generated', 'appExtensionRegistry.ts'),
    'utf8',
  );
  if (!extensionRegistry.includes('BarcodeScannerView: ExpoBarcodeScannerView')) {
    throw new Error('Generated component registry does not install the Expo scanner adapter.');
  }

  const oauthRuntime = await readFile(path.join(projectRoot, 'src', 'auth', 'oauth.ts'), 'utf8');
  const authAdapter = await readFile(path.join(projectRoot, 'src', 'auth', 'adapter.ts'), 'utf8');
  const oauthCompletion = await readFile(
    path.join(projectRoot, 'src', 'auth', 'oauth-completion.ts'),
    'utf8',
  );
  const oauthState = await readFile(
    path.join(projectRoot, 'src', 'auth', 'oauth-state.ts'),
    'utf8',
  );
  for (const expected of ['WebBrowser.openAuthSessionAsync(', 'oauth.completeAuthorization({']) {
    if (!oauthRuntime.includes(expected)) {
      throw new Error(`Generated capability OAuth runtime is missing ${expected}.`);
    }
  }
  for (const expected of [
    "import { getRandomBytes } from 'expo-crypto';",
    'oauthRandomBytes: getRandomBytes',
  ]) {
    if (!authAdapter.includes(expected)) {
      throw new Error(`Generated capability auth adapter is missing ${expected}.`);
    }
  }
  if (!oauthCompletion.includes('Linking.createURL(callbackPath, { scheme: nativeScheme })')) {
    throw new Error('Generated capability OAuth completion is missing its native redirect URI.');
  }
  if (!oauthState.includes("const OAUTH_TRANSPORT_ATTEMPT_KEY = 'ankh.auth.oauth.transport';")) {
    throw new Error('Generated capability OAuth state is missing its correlation marker.');
  }
  if (oauthRuntime.includes('access_token') || oauthRuntime.includes('setSession(')) {
    throw new Error('Generated capability OAuth runtime bypasses the canonical auth adapter.');
  }

  const sessionRuntime = await readFile(
    path.join(projectRoot, 'src', 'auth', 'session.ts'),
    'utf8',
  );
  for (const expected of [
    "import * as SecureStore from 'expo-secure-store';",
    'SecureStore.getItemAsync(key)',
    'SecureStore.setItemAsync(key, value)',
    'SecureStore.deleteItemAsync(key)',
  ]) {
    if (!sessionRuntime.includes(expected)) {
      throw new Error(`Generated capability session runtime is missing ${expected}.`);
    }
  }
}

async function assertNoObsoleteSourceAsync(projectRoot: string): Promise<void> {
  const generatedSource = await readSourceTreeAsync(path.join(projectRoot, 'src'));
  for (const forbiddenSource of [
    'ankh.auth.oauth.transport.v1',
    'ankh.auth.oauth.transport.v2',
    "from 'expo/fetch'",
    'readAsStringAsync(',
  ]) {
    if (generatedSource.includes(forbiddenSource)) {
      throw new Error(`Generated capability source contains obsolete path ${forbiddenSource}.`);
    }
  }
}

async function listFilesAsync(rootPath: string): Promise<string[]> {
  const entries = await readdir(rootPath, { withFileTypes: true });
  const files: string[] = [];
  for (const entry of entries) {
    const entryPath = path.join(rootPath, entry.name);
    if (entry.isDirectory()) files.push(...(await listFilesAsync(entryPath)));
    else if (entry.isFile()) files.push(entryPath);
  }
  return files;
}

async function readSourceTreeAsync(sourceRoot: string): Promise<string> {
  const sourceFiles = (await listFilesAsync(sourceRoot)).filter((file) =>
    /\.[cm]?[jt]sx?$/u.test(file),
  );
  return (await Promise.all(sourceFiles.map((file) => readFile(file, 'utf8')))).join('\n');
}

interface GeneratedPackageJson {
  readonly dependencies?: Readonly<Record<string, string>>;
}
