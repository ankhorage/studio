import type { ExpoRuntimePlan } from '@ankhorage/expo-runtime/planning';
import {
  getExpoBarcodeScannerViewSource,
  getExpoReaderSurfaceViewSource,
} from '@ankhorage/expo-runtime/planning';
import { promises as fs } from 'fs';
import path from 'path';

import { syncProjectBundledMediaRegistry } from '../media/projectBundledMediaRegistry';
import { type ZoraExtensionDefinition } from '../zoraExtensions';

export interface GeneratedAppFilesOptions {
  runtimePlan?: ExpoRuntimePlan;
  zoraExtensions?: readonly ZoraExtensionDefinition[];
}

const FORBIDDEN_SPECIFIER_PATTERN = /['"]@ankh\//;
const GENERATED_APP_SCAN_FILES = ['package.json', 'tsconfig.json', 'app.config.ts'];

export async function syncGeneratedAppFiles(
  targetProjectPath: string,
  options: GeneratedAppFilesOptions = {},
) {
  const { runtimePlan, zoraExtensions = [] } = options;
  const generatedDest = path.join(targetProjectPath, 'src/generated');
  const appExtensionRegistryDest = path.join(generatedDest, 'appExtensionRegistry.ts');
  const expoBarcodeScannerDest = path.join(generatedDest, 'expo/ExpoBarcodeScannerView.tsx');
  const expoReaderSurfaceDest = path.join(generatedDest, 'expo/ExpoReaderSurfaceView.tsx');
  const usesExpoBarcodeScannerAdapter =
    runtimePlan?.runtimeAdapters.includes('ExpoBarcodeScannerAdapter') ?? false;
  const usesExpoReaderSurfaceAdapter =
    runtimePlan?.runtimeAdapters.includes('ExpoReaderSurfaceAdapter') ?? false;

  await Promise.all([
    removePath(appExtensionRegistryDest),
    removePath(expoBarcodeScannerDest),
    removePath(expoReaderSurfaceDest),
  ]);
  await fs.mkdir(generatedDest, { recursive: true });

  if (usesExpoBarcodeScannerAdapter) {
    await fs.mkdir(path.dirname(expoBarcodeScannerDest), { recursive: true });
    await fs.writeFile(expoBarcodeScannerDest, getExpoBarcodeScannerViewSource(), 'utf8');
  }
  if (usesExpoReaderSurfaceAdapter) {
    await fs.mkdir(path.dirname(expoReaderSurfaceDest), { recursive: true });
    await fs.writeFile(expoReaderSurfaceDest, getExpoReaderSurfaceViewSource(), 'utf8');
  }

  await fs.writeFile(
    appExtensionRegistryDest,
    createGeneratedAppExtensionRegistrySource({
      usesExpoBarcodeScannerAdapter,
      usesExpoReaderSurfaceAdapter,
      zoraExtensions,
    }),
    'utf8',
  );
  await syncProjectBundledMediaRegistry(targetProjectPath);

  await assertNoForbiddenSpecifiers(targetProjectPath);
}

export function createGeneratedAppExtensionRegistrySource(args: {
  usesExpoBarcodeScannerAdapter: boolean;
  usesExpoReaderSurfaceAdapter: boolean;
  zoraExtensions: readonly ZoraExtensionDefinition[];
}): string {
  const externalImportLines = new Set<string>();
  const relativeImportLines = new Set<string>();
  const interactionPolicySupportedComponents = new Set<string>();
  const entries = args.zoraExtensions
    .flatMap((extension) => {
      const exportNames = Array.from(new Set(Object.values(extension.components))).sort();
      externalImportLines.add(
        `import { ${exportNames.join(', ')} } from '${extension.packageName}';`,
      );

      for (const componentName of extension.interactionPolicySupportedComponents ?? []) {
        if (!Object.prototype.hasOwnProperty.call(extension.components, componentName)) {
          throw new Error(
            `ZORA extension ${extension.packageName} declares interaction-policy support for unregistered component ${componentName}.`,
          );
        }
        interactionPolicySupportedComponents.add(componentName);
      }

      return Object.entries(extension.components).map(([componentName, exportName]) => ({
        componentName,
        exportName,
      }));
    })
    .sort((left, right) => left.componentName.localeCompare(right.componentName));

  if (args.usesExpoBarcodeScannerAdapter) {
    relativeImportLines.add(
      "import { ExpoBarcodeScannerView } from './expo/ExpoBarcodeScannerView';",
    );
    entries.unshift({
      componentName: 'BarcodeScannerView',
      exportName: 'ExpoBarcodeScannerView',
    });
  }
  if (args.usesExpoReaderSurfaceAdapter) {
    relativeImportLines.add(
      "import { ExpoReaderSurfaceView } from './expo/ExpoReaderSurfaceView';",
    );
    entries.unshift({
      componentName: 'ReaderSurface',
      exportName: 'ExpoReaderSurfaceView',
    });
  }

  const registryEntries = entries
    .map(({ componentName, exportName }) => `  ${formatRegistryKey(componentName)}: ${exportName},`)
    .join('\n');
  const interactionPolicySupportEntries = [...interactionPolicySupportedComponents]
    .sort()
    .map((componentName) => `  ${formatRegistryKey(componentName)}: true,`)
    .join('\n');

  const componentRegistry = registryEntries
    ? `export const APP_EXTENSION_COMPONENT_REGISTRY: ComponentRegistry = {\n${registryEntries}\n};`
    : 'export const APP_EXTENSION_COMPONENT_REGISTRY: ComponentRegistry = {};';
  const interactionPolicySupport = interactionPolicySupportEntries
    ? `export const APP_EXTENSION_INTERACTION_POLICY_SUPPORT = {\n${interactionPolicySupportEntries}\n} as const;`
    : 'export const APP_EXTENSION_INTERACTION_POLICY_SUPPORT = {} as const;';

  return [
    "import type { ComponentRegistry } from '@ankhorage/runtime';",
    ...[...externalImportLines].sort(),
    ...(relativeImportLines.size > 0 ? ['', ...[...relativeImportLines].sort()] : []),
    '',
    componentRegistry,
    '',
    interactionPolicySupport,
    '',
  ]
    .filter((line, index, lines) => line.length > 0 || lines[index - 1]?.length !== 0)
    .join('\n');
}

function formatRegistryKey(key: string): string {
  if (/^[A-Za-z_$][A-Za-z0-9_$]*$/.test(key)) {
    return key;
  }

  return JSON.stringify(key);
}

async function removePath(pathToRemove: string) {
  await fs.rm(pathToRemove, { recursive: true, force: true });
}

async function assertNoForbiddenSpecifiers(targetProjectPath: string) {
  const filesToCheck = GENERATED_APP_SCAN_FILES.map((file) => path.join(targetProjectPath, file));
  filesToCheck.push(...(await listSourceFiles(path.join(targetProjectPath, 'src'))));

  for (const filePath of filesToCheck) {
    let source;
    try {
      source = await fs.readFile(filePath, 'utf8');
    } catch (error) {
      if (isMissingPathError(error)) continue;
      throw error;
    }

    if (FORBIDDEN_SPECIFIER_PATTERN.test(source)) {
      throw new Error(`Generated app file ${filePath} still references @ankh/* packages.`);
    }
  }
}

async function listSourceFiles(rootPath: string): Promise<string[]> {
  let entries;
  try {
    entries = await fs.readdir(rootPath, { withFileTypes: true });
  } catch (error) {
    if (isMissingPathError(error)) return [];
    throw error;
  }

  const files = [];
  for (const entry of entries) {
    const entryPath = path.join(rootPath, entry.name);
    if (entry.isDirectory()) {
      files.push(...(await listSourceFiles(entryPath)));
      continue;
    }
    if (entry.isFile() && /\.(?:[cm]?[jt]sx?|json)$/.test(entry.name)) {
      files.push(entryPath);
    }
  }
  return files;
}

function isMissingPathError(error: unknown): error is NodeJS.ErrnoException {
  return error instanceof Error && 'code' in error && error.code === 'ENOENT';
}
