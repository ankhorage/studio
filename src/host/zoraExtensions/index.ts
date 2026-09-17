import type { AppManifest, UiNode } from '@ankhorage/contracts';
import type { ZoraPluginDescriptor } from '@ankhorage/zora';
import { readOwnProperty } from '@ankhorage/utility/object';

import { STUDIO_ZORA_EXTENSION_SOURCES } from '../../constants';
import { getGeneratedPackagePolicy } from '../../features/project-updates/adapters/outbound/getGeneratedPackagePolicy';

export interface ZoraExtensionDefinition {
  packageName: string;
  descriptorExportName: string;
  componentTypes: readonly string[];
  dependencies?: Readonly<Record<string, string>>;
}

const KNOWN_ZORA_EXTENSIONS = STUDIO_ZORA_EXTENSION_SOURCES.map(
  ({ descriptorExportName, plugin }) => createZoraExtensionDefinition(plugin, descriptorExportName),
);

/***
 * Resolve extension packages from the component types actually used by one manifest.
 * @todo Move ZORA extension discovery from the host edge to project-generation/module ownership; host should consume the resolved extension plan.
 */
export function resolveZoraExtensionsForManifest(
  manifest: AppManifest,
): readonly ZoraExtensionDefinition[] {
  const componentTypes = new Set<string>();
  for (const screen of Object.values(manifest.screens)) {
    collectNodeTypes(screen.root, componentTypes);
  }
  return KNOWN_ZORA_EXTENSIONS.filter((extension) =>
    extension.componentTypes.some((componentType) => componentTypes.has(componentType)),
  );
}

/***
 * Resolve known ZORA extensions from a package dependency record.
 * @todo Keep dependency-to-extension projection with the same project-generation/module owner as manifest extension discovery.
 */
export function resolveZoraExtensionsFromDependencies(
  dependencies: Readonly<Record<string, string>>,
): readonly ZoraExtensionDefinition[] {
  return KNOWN_ZORA_EXTENSIONS.filter((extension) => extension.packageName in dependencies);
}

/*** Merge extension lists by package ownership, with later definitions replacing earlier definitions for the same package. */
export function mergeZoraExtensions(
  ...extensionLists: readonly (readonly ZoraExtensionDefinition[])[]
): readonly ZoraExtensionDefinition[] {
  const extensions = new Map<string, ZoraExtensionDefinition>();

  for (const extensionList of extensionLists) {
    for (const extension of extensionList) {
      extensions.set(extension.packageName, extension);
    }
  }

  return [...extensions.values()];
}

/*** Project dependency requirements from selected ZORA extension definitions. */
export function collectZoraExtensionDependencies(
  extensions: readonly ZoraExtensionDefinition[],
): Record<string, string> {
  return extensions.reduce<Record<string, string>>((dependencies, extension) => {
    return {
      ...dependencies,
      ...(extension.dependencies ?? {}),
    };
  }, {});
}

/*** Build one generated-app extension definition from the installed plugin descriptor and Studio dependency policy. */
function createZoraExtensionDefinition(
  plugin: ZoraPluginDescriptor,
  descriptorExportName: string,
): ZoraExtensionDefinition {
  const dependencyRange = readOwnProperty(
    getGeneratedPackagePolicy().dependencies.zoraExtensions,
    plugin.packageName,
  );
  if (typeof dependencyRange !== 'string' || dependencyRange.trim() === '') {
    throw new Error(
      `Studio package policy is missing the dependency range for ZORA extension ${plugin.packageName}.`,
    );
  }

  return {
    packageName: plugin.packageName,
    descriptorExportName,
    componentTypes: Object.keys(plugin.componentRegistry).sort(),
    dependencies: Object.fromEntries([[plugin.packageName, dependencyRange]]),
  };
}

/*** Collect component types recursively from one manifest UI node. */
function collectNodeTypes(node: UiNode, componentTypes: Set<string>): void {
  componentTypes.add(node.type);
  node.children?.forEach((child) => collectNodeTypes(child, componentTypes));
  node.repeat?.empty?.forEach((child) => collectNodeTypes(child, componentTypes));
}
