import type { ProjectTemplateSelection } from '../templateRegistry';

export interface ZoraExtensionDefinition {
  packageName: string;
  components: Record<string, string>;
  dependencies?: Record<string, string>;
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
const TABLETOP_TEMPLATE_IDS = new Set(['card-trainer', 'card_trainer', 'poker']);

export function resolveZoraExtensionsForTemplateSelection(
  selection: ProjectTemplateSelection,
): readonly ZoraExtensionDefinition[] {
  if (selection.category === 'games' && selection.templateId === 'chess') {
    return [ZORA_CHESS_EXTENSION];
  }

  if (selection.category === 'games' && TABLETOP_TEMPLATE_IDS.has(selection.templateId)) {
    return [ZORA_TABLETOP_EXTENSION];
  }

  return [];
}

export function resolveZoraExtensionsFromDependencies(
  dependencies: Readonly<Record<string, string>>,
): readonly ZoraExtensionDefinition[] {
  return KNOWN_ZORA_EXTENSIONS.filter((extension) => extension.packageName in dependencies);
}

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

function formatRegistryKey(key: string): string {
  if (/^[A-Za-z_$][A-Za-z0-9_$]*$/.test(key)) return key;
  return JSON.stringify(key);
}
