import type { AppManifest, UiNode } from '@ankhorage/contracts';

export interface ZoraExtensionDefinition {
  packageName: string;
  components: Record<string, string>;
  dependencies?: Record<string, string>;
  interactionPolicySupportedComponents?: readonly string[];
}

const ZORA_CHESS_EXTENSION = {
  packageName: '@ankhorage/zora-chess',
  components: {
    ChessBoard: 'ChessBoard',
    OpeningBook: 'OpeningBook',
  },
  dependencies: {
    '@ankhorage/zora-chess': 'latest',
  },
} satisfies ZoraExtensionDefinition;

const ZORA_TABLETOP_EXTENSION = {
  packageName: '@ankhorage/zora-tabletop',
  components: {
    TabletopTable: 'TabletopTable',
    Table: 'TabletopTable',
    'zora-tabletop/Table': 'TabletopTable',
    '@ankhorage/zora-tabletop/Table': 'TabletopTable',
  },
  dependencies: {
    '@ankhorage/zora-tabletop': 'latest',
  },
} satisfies ZoraExtensionDefinition;

const KNOWN_ZORA_EXTENSIONS = [ZORA_CHESS_EXTENSION, ZORA_TABLETOP_EXTENSION] as const;

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
    Object.keys(extension.components).some((componentType) => componentTypes.has(componentType)),
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

/***
 * Project dependency requirements from selected ZORA extension definitions.
 * @todo Replace extension dependency ranges such as `latest` with canonical owned release ranges; generated projects must not bypass reproducible dependency ownership.
 */
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

/*** Collect component types recursively from one manifest UI node. */
function collectNodeTypes(node: UiNode, componentTypes: Set<string>): void {
  componentTypes.add(node.type);
  node.children?.forEach((child) => collectNodeTypes(child, componentTypes));
  node.repeat?.empty?.forEach((child) => collectNodeTypes(child, componentTypes));
}
