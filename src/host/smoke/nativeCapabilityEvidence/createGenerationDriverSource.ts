import {
  NATIVE_EVIDENCE_ANDROID_PACKAGE,
  NATIVE_EVIDENCE_ANDROID_SCHEME,
  NATIVE_EVIDENCE_APP_ID,
  NATIVE_EVIDENCE_IOS_BUNDLE_IDENTIFIER,
  NATIVE_EVIDENCE_IOS_SCHEME,
} from './constants';

/*** Create the temporary generation-driver source used by the native capability evidence harness.
 * @todo Move this acceptance-fixture source generator from src/host/smoke to test/smoke/nativeCapabilityEvidence.
 */
export function createGenerationDriverSource(workspaceRoot: string): string {
  return `import { mkdir, readFile, writeFile } from 'node:fs/promises';

import { EXPO_PLATFORM } from '@ankhorage/expo-runtime/platform';
import { PERMISSIONS } from '@ankhorage/permissions';
import { ProjectManager } from '@ankhorage/studio/host';
import { createOAuthFixtureManifest } from '@ankhorage/templates';

const workspaceRoot = ${JSON.stringify(workspaceRoot)};
await mkdir(\`\${workspaceRoot}/apps\`, { recursive: true });
await Bun.write(
  \`\${workspaceRoot}/package.json\`,
  \`${JSON.stringify(
    {
      name: '@ankhorage/expo57-native-capability-evidence',
      packageManager: 'bun@1.3.14',
      private: true,
      workspaces: ['apps/*'],
    },
    null,
    2,
  )}\\n\`,
);
await Bun.write(\`\${workspaceRoot}/bunfig.toml\`, '[install]\\nlinker = "hoisted"\\n');

const manager = new ProjectManager(workspaceRoot);
const created = await manager.createProject(
  'Expo 57 Native Capability Evidence',
  { category: 'developer_tools', templateId: 'default' },
  undefined,
  { includeStudio: false },
);
const baseManifest = createOAuthFixtureManifest({
  category: 'developer_tools',
  fixture: 'google',
  overrides: {
    metadata: {
      name: 'Expo 57 Native Capability Evidence',
      slug: '${NATIVE_EVIDENCE_APP_ID}',
    },
  },
});
await manager.saveProjectManifest({
  projectId: created.id,
  mutations: [],
  manifest: {
    ...baseManifest,
    deploy: {
      targets: {
        android: {
          enabled: true,
          package: '${NATIVE_EVIDENCE_ANDROID_PACKAGE}',
          scheme: '${NATIVE_EVIDENCE_ANDROID_SCHEME}',
        },
        ios: {
          bundleIdentifier: '${NATIVE_EVIDENCE_IOS_BUNDLE_IDENTIFIER}',
          enabled: true,
          scheme: '${NATIVE_EVIDENCE_IOS_SCHEME}',
        },
        web: { enabled: true },
      },
    },
    navigator: {
      type: 'stack',
      initialRouteName: 'index',
      routes: [{ name: 'index', screenId: 'native-evidence' }],
    },
    screens: {
      'native-evidence': {
        id: 'native-evidence',
        name: 'Native evidence',
        requires: {
          capabilities: [{ capability: 'barcodeScanner' }],
          permissions: PERMISSIONS.map((permission) => ({ permission })),
        },
        root: {
          id: 'native-evidence-screen',
          type: 'Screen',
          props: { testID: 'native-evidence-screen' },
          children: [
            {
              id: 'native-evidence-scanner',
              type: 'BarcodeScannerView',
              props: {
                description: 'Generated Expo capability native evidence',
                permissionStatus: 'unknown',
                testID: 'native-evidence-scanner',
                title: 'Scan a barcode',
              },
            },
          ],
        },
      },
    },
  },
});

const appPackagePath = \`\${created.path}/package.json\`;
const appPackage = JSON.parse(await readFile(appPackagePath, 'utf8'));
for (const dependency of [
  EXPO_PLATFORM.packages.devClient,
  EXPO_PLATFORM.packages.documentPicker,
  EXPO_PLATFORM.packages.fileSystem,
  EXPO_PLATFORM.packages.imagePicker,
]) {
  appPackage.dependencies[dependency.name] = dependency.version;
}
await writeFile(appPackagePath, \`\${JSON.stringify(appPackage, null, 2)}\\n\`, 'utf8');

console.log(JSON.stringify({ id: created.id, path: created.path }));
`;
}
