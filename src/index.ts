import type {
  ActionType,
  AppDataManifest,
  AppManifest,
  AuthOAuthProviderConfig,
  ComponentDataBindingRegistry,
  DataSourceRegistry,
  NavigatorType,
  RouteDefinition,
  ThemeConfig,
  ThemeModeConfig,
  UiNode,
} from '@ankhorage/contracts';

import type { StudioAuthSettings, StudioAuthSettingsMutation } from './authSettings';

export type {
  ProjectAuthDiagnostic,
  ProjectAuthDiagnosticSeverity,
  ProjectAuthHealth,
  ProjectAuthHealthStatus,
  ProjectOAuthProviderHealth,
  ProjectOAuthProviderHealthStatus,
} from './projectAuthHealth';
export {
  deriveProjectId,
  ProjectCreationValidationError,
  validateProjectCreationInput,
} from './projectIdentity';
export type {
  ProjectSecretUsage,
  ProjectSecretUsageCategory,
  ProjectSecretUsageSummary,
} from './projectSecretUsage';
export type {
  ProjectCreationValidationCode,
  ProjectCreationValidationFailure,
  ProjectCreationValidationResult,
  ProjectSortKey,
  StudioProjectSummary,
} from './projectWorkspaceContracts';
export * from './propertiesAuthoringModel';
export type {
  TemplateCatalog,
  TemplateCatalogCategory,
  TemplateCatalogTemplate,
  TemplateEntry,
} from './templateCatalogContracts';

export const STUDIO_PACKAGE_NAME = '@ankhorage/studio' as const;

export interface StudioPackageBoundary {
  readonly owns: readonly string[];
  readonly consumes: readonly string[];
  readonly doesNotOwn: readonly string[];
}

export const STUDIO_PACKAGE_BOUNDARY: StudioPackageBoundary = {
  owns: [
    'Studio authoring contracts',
    'Studio product contracts',
    'Studio manifest editing contracts',
    'Studio command and event contracts',
    'Studio authoring model helpers',
  ],
  consumes: [
    '@ankhorage/contracts',
    '@ankhorage/runtime',
    '@ankhorage/expo-runtime',
    '@ankhorage/templates',
    '@ankhorage/ankh',
    '@ankhorage/zora',
  ],
  doesNotOwn: [
    'generic runtime renderer behavior',
    'generic runtime actions or bindings',
    'Expo runtime planning',
    'generated-app runtime composition code',
    'template catalog content',
    'root command bus behavior',
    'React Native UI components',
    'ZORA component metadata or authoring authority',
    'DnD implementation',
    'Supabase storage implementation',
  ],
};

export const STUDIO_PUBLIC_CONTRACTS = [
  'StudioManifest',
  'StudioContextValue',
  'StudioSelectionState',
  'NodePlacement',
  'InsertCatalogEntry',
  'ActionDefinition',
  'StudioCommand',
  'StudioEvent',
  'StudioComponentMetaRegistry',
  'StudioInstancePropertyField',
  'resolveStudioInstancePropertyGroups',
  'createStudioInstancePropertyPatch',
  'ProjectAuthHealth',
  'ProjectSecretUsageSummary',
  'StudioAdminRouteId',
  'StudioAdminRoutePath',
  'ACTION_REGISTRY',
  'TPL_SCREEN_EMPTY',
  'resolveDefaultInsertPlacement',
  'buildInsertCatalogEntries',
] as const;

export type StudioPublicContract = (typeof STUDIO_PUBLIC_CONTRACTS)[number];

export type StudioProjectId = string;
export type StudioSessionId = string;
export type StudioNodeId = string;
export type StudioScreenId = string;
export type StudioModuleId = string;
export type StudioLocale = string;

export type StudioMode = 'light' | 'dark';
export type StudioSaveStatus = 'idle' | 'saving' | 'saved' | 'error';
export type StudioPanelId = 'layers' | 'modules' | 'localization';
export type StudioAdminRouteId =
  | 'overview'
  | 'apis'
  | 'api-data-sources'
  | 'api-operations'
  | 'auth'
  | 'auth-providers'
  | 'auth-routes'
  | 'auth-profile'
  | 'secrets'
  | 'theme'
  | 'properties';
export type StudioAdminStaticRoutePath =
  | '/ankh'
  | '/ankh/apis'
  | '/ankh/apis/data-sources'
  | '/ankh/apis/operations'
  | '/ankh/auth'
  | '/ankh/auth/providers'
  | '/ankh/auth/routes'
  | '/ankh/auth/profile'
  | '/ankh/secrets'
  | '/ankh/theme';
export type StudioAdminRoutePath =
  | StudioAdminStaticRoutePath
  | `/ankh/properties/${string}`;

export interface StudioSelectionState {
  readonly selectedNodeId: StudioNodeId | null;
  readonly hoveredNodeId: StudioNodeId | null;
  readonly focusedNodeId: StudioNodeId | null;
}

export type StudioModeChangeReason = 'user' | 'system' | 'manifest';

export interface StudioModeChange {
  readonly mode: StudioMode;
  readonly reason: StudioModeChangeReason;
}

export interface StudioActionDefinition {
  readonly id: string;
  readonly label: string;
  readonly icon?: string;
  readonly capability?: string;
}

export interface StudioComponentMeta {
  readonly category: 'foundation' | 'component' | 'pattern' | 'layout';
  readonly allowedChildren: readonly string[];
  readonly directManifestNode: boolean;
  readonly blueprint?: {
    readonly label: string;
    readonly icon?: { readonly name: string; readonly provider?: string };
    readonly defaultProps?: Readonly<Record<string, unknown>>;
  };
  readonly events?: Readonly<Record<string, unknown>>;
  readonly slots?: Readonly<Record<string, unknown>>;
  readonly requirements?: Readonly<Record<string, unknown>>;
}

export type StudioComponentMetaRegistry = Readonly<Record<string, StudioComponentMeta>>;

export interface StudioManifest extends AppManifest {
  readonly settings?: AppManifest['settings'];
}

export interface StudioContextValue {
  readonly projectId: string;
  readonly activeLocale: string;
  readonly activeScreenId: StudioScreenId | null;
  readonly selectedNodeId: StudioNodeId | null;
  readonly activePanelId: StudioPanelId | null;
  readonly activeAdminRouteId: StudioAdminRouteId;
  readonly activeCanvasDragNodeId: StudioNodeId | null;
  readonly studioMode: StudioMode;
  readonly previewMode: boolean;
  readonly lastNonAdminLocation: string;
  readonly saveStatus: StudioSaveStatus;
  readonly isLoading: boolean;
  readonly error: string | null;
  readonly manifest: StudioManifest | null;
  readonly rootNode: UiNode | null;
  readonly selectNode: (nodeId: StudioNodeId | null) => void;
  readonly setActivePanelId: (panelId: StudioPanelId | null) => void;
  readonly setActiveAdminRouteId: (routeId: StudioAdminRouteId) => void;
  readonly setLastNonAdminLocation: (location: string) => void;
  readonly setActiveCanvasDragNodeId: (nodeId: StudioNodeId | null) => void;
  readonly updateNode: (nodeId: StudioNodeId, props: Record<string, unknown>) => void;
  readonly updateAppData: (data: AppDataManifest) => void;
  readonly updateDataBindings: (dataBindings: ComponentDataBindingRegistry) => void;
  readonly updateDataSources: (dataSources: DataSourceRegistry) => void;
  readonly deleteNode: (nodeId: StudioNodeId) => void;
  readonly insertFromCatalogEntry: (entry: InsertCatalogEntry) => boolean;
  readonly moveNodeToPlacement: (nodeId: StudioNodeId, placement: NodePlacement) => boolean;
  readonly addScreen: (name?: string) => void;
  readonly deleteScreen: (screenId: StudioScreenId) => void;
  readonly setNavigatorType: (type: NavigatorType) => void;
  readonly setNavigatorInitialRoute: (screenId: StudioScreenId) => void;
  readonly addTheme: (name?: string) => void;
  readonly updateTheme: (id: string, updates: ThemeUpdates) => void;
  readonly deleteTheme: (id: string) => void;
  readonly setActiveThemeId: (id: string) => void;
  readonly setActiveThemeMode: (mode: StudioMode) => void;
  readonly updateAuthSettings: (settings: StudioAuthSettings) => void;
  readonly mutateAuthSettings: (
    mutation: StudioAuthSettingsMutation,
  ) => StudioAuthSettings | null;
  readonly updateModuleConfig: (moduleId: StudioModuleId, config: Record<string, unknown>) => void;
  readonly updateOAuthProviders: (providers: AuthOAuthProviderConfig[]) => void;
  readonly moveNode: (nodeId: StudioNodeId, direction: 'up' | 'down') => void;
  readonly reorderScreens: (newRoutes: RouteDefinition[]) => void;
  readonly setActiveScreenId: (screenId: StudioScreenId | null) => void;
  readonly findNode: (root: UiNode, nodeId: StudioNodeId) => UiNode | null;
  readonly setStudioMode: (mode: StudioMode) => void;
  readonly togglePreviewMode: () => void;
  readonly t: (key: string) => string;
  readonly setActiveLocale: (locale: string) => void;
  readonly reloadDictionaries: () => Promise<void>;
  readonly refetchManifest: () => Promise<void>;
  readonly flushManifest: () => Promise<void>;
}

export interface NodePlacement {
  readonly parentId: StudioNodeId;
  readonly index: number;
  readonly kind: 'before' | 'inside' | 'after';
  readonly referenceId?: StudioNodeId;
}

export interface InsertCatalogEntry {
  readonly id: string;
  readonly label: string;
  readonly category: string;
  readonly type: string;
  readonly defaultProps?: Readonly<Record<string, unknown>>;
  readonly recipe?: UiNode;
}

export interface ResolvedInsertCatalogEntry extends InsertCatalogEntry {
  readonly status: 'enabled' | 'disabled';
  readonly placement?: NodePlacement;
  readonly disabledReason?: {
    readonly code: string;
    readonly message: string;
  };
}

export type StudioIdGenerator = (prefix?: string) => string;

export interface ThemeUpdates {
  readonly name?: string;
  readonly modes?: Partial<Record<StudioMode, Partial<ThemeModeConfig>>>;
}

export interface StudioModuleConfig {
  readonly moduleId: StudioModuleId;
  readonly config: Record<string, unknown>;
}

export interface ActionDefinition {
  readonly id: string;
  readonly type: ActionType;
  readonly label: string;
  readonly description?: string;
  readonly requiresPayload: boolean;
  readonly payloadSchema?: Record<string, { readonly required: boolean }>;
}

export interface StudioCommand {
  readonly id: string;
  readonly type: string;
  readonly payload?: unknown;
}

export interface StudioEvent {
  readonly type: string;
  readonly payload?: unknown;
}

export const ACTION_REGISTRY: Readonly<Record<string, ActionDefinition>> = {
  navigate: {
    id: 'navigate',
    type: 'navigate',
    label: 'Navigate',
    requiresPayload: true,
    payloadSchema: { route: { required: true } },
  },
  toggleDarkMode: {
    id: 'toggleDarkMode',
    type: 'toggleDarkMode',
    label: 'Toggle dark mode',
    requiresPayload: false,
  },
};

export const TPL_SCREEN_EMPTY: UiNode = {
  id: 'tpl-screen-empty',
  type: 'Screen',
  props: { width: 'wide' },
  children: [],
};

export function findNodeById(root: UiNode, nodeId: StudioNodeId): UiNode | null {
  if (root.id === nodeId) return root;
  for (const child of root.children ?? []) {
    const found = findNodeById(child, nodeId);
    if (found) return found;
  }
  return null;
}

export function cloneWithNewIds(node: UiNode, makeId: StudioIdGenerator): UiNode {
  return {
    ...node,
    id: makeId(node.type),
    children: node.children?.map((child) => cloneWithNewIds(child, makeId)),
  };
}

export function updateNodeInTree(
  root: UiNode,
  nodeId: StudioNodeId,
  updates: Record<string, unknown>,
): UiNode {
  if (root.id === nodeId) return { ...root, ...updates };
  if (!root.children) return root;

  const children = root.children.map((child) => updateNodeInTree(child, nodeId, updates));
  if (children.every((child, index) => child === root.children?.[index])) return root;
  return { ...root, children };
}

export function resolveDefaultInsertPlacement(args: {
  readonly root: UiNode;
  readonly selectedNodeId: StudioNodeId | null;
  readonly childType: string;
  readonly componentMeta: StudioComponentMetaRegistry;
}):
  | { readonly ok: true; readonly placement: NodePlacement }
  | { readonly ok: false; readonly reason: string } {
  const selected = args.selectedNodeId ? findNodeById(args.root, args.selectedNodeId) : null;
  if (!selected) {
    return { ok: true, placement: { parentId: args.root.id, index: 0, kind: 'inside' } };
  }

  const selectedMeta = new Map(Object.entries(args.componentMeta)).get(selected.type);
  if (selectedMeta?.allowedChildren.includes(args.childType)) {
    return {
      ok: true,
      placement: {
        parentId: selected.id,
        index: selected.children?.length ?? 0,
        kind: 'inside',
      },
    };
  }

  const parent = findParent(args.root, selected.id);
  if (!parent) return { ok: false, reason: 'No valid insertion parent.' };
  const index = parent.children?.findIndex((child) => child.id === selected.id) ?? -1;
  if (index < 0) return { ok: false, reason: 'Selected node is not in its parent.' };
  return {
    ok: true,
    placement: {
      parentId: parent.id,
      index: index + 1,
      kind: 'after',
      referenceId: selected.id,
    },
  };
}

export function buildInsertCatalogEntries(args: {
  readonly componentMeta: StudioComponentMetaRegistry;
  readonly recipes?: readonly InsertCatalogEntry[];
}): readonly InsertCatalogEntry[] {
  const components = Object.entries(args.componentMeta).map(([type, meta]) => ({
    id: `component:${type}`,
    label: meta.blueprint?.label ?? type,
    category: meta.category,
    type,
    defaultProps: meta.blueprint?.defaultProps,
  }));
  return [...components, ...(args.recipes ?? [])];
}

export function resolveInsertCatalogEntries(args: {
  readonly entries: readonly InsertCatalogEntry[];
  readonly root: UiNode;
  readonly selectedNodeId: StudioNodeId | null;
  readonly componentMeta: StudioComponentMetaRegistry;
}): readonly ResolvedInsertCatalogEntry[] {
  return args.entries.map((entry) => {
    const meta = new Map(Object.entries(args.componentMeta)).get(entry.type);
    if (!meta?.directManifestNode) {
      return {
        ...entry,
        status: 'disabled' as const,
        disabledReason: { code: 'not-direct', message: 'Not a direct manifest node.' },
      };
    }
    const placement = resolveDefaultInsertPlacement({
      root: args.root,
      selectedNodeId: args.selectedNodeId,
      childType: entry.type,
      componentMeta: args.componentMeta,
    });
    return placement.ok
      ? { ...entry, status: 'enabled' as const, placement: placement.placement }
      : {
          ...entry,
          status: 'disabled' as const,
          disabledReason: { code: 'invalid-placement', message: placement.reason },
        };
  });
}

export function createNodeFromCatalogEntry(
  entry: InsertCatalogEntry,
  componentMeta: StudioComponentMetaRegistry,
  makeId: StudioIdGenerator,
): UiNode {
  if (entry.recipe) return cloneWithNewIds(entry.recipe, makeId);
  const meta = new Map(Object.entries(componentMeta)).get(entry.type);
  return {
    id: makeId(entry.type),
    type: entry.type,
    props: { ...(meta?.blueprint?.defaultProps ?? entry.defaultProps ?? {}) },
    children: [],
  };
}

export function insertNodeAtPlacement(args: {
  readonly root: UiNode;
  readonly placement: NodePlacement;
  readonly componentMeta: StudioComponentMetaRegistry;
  readonly makeNode: () => UiNode;
}): UiNode | null {
  const node = args.makeNode();
  if (!new Map(Object.entries(args.componentMeta)).get(node.type)) return null;
  return insertIntoTree(args.root, args.placement, node);
}

export function moveNodeToPlacement(args: {
  readonly root: UiNode;
  readonly nodeId: StudioNodeId;
  readonly placement: NodePlacement;
  readonly componentMeta: StudioComponentMetaRegistry;
}): UiNode | null {
  const node = findNodeById(args.root, args.nodeId);
  if (!node || args.root.id === node.id) return null;
  const withoutNode = removeFromTree(args.root, args.nodeId);
  if (!withoutNode) return null;
  return insertIntoTree(withoutNode, args.placement, node);
}

function findParent(root: UiNode, nodeId: StudioNodeId): UiNode | null {
  for (const child of root.children ?? []) {
    if (child.id === nodeId) return root;
    const found = findParent(child, nodeId);
    if (found) return found;
  }
  return null;
}

function insertIntoTree(root: UiNode, placement: NodePlacement, node: UiNode): UiNode | null {
  if (root.id === placement.parentId) {
    const children = [...(root.children ?? [])];
    children.splice(placement.index, 0, node);
    return { ...root, children };
  }
  if (!root.children) return null;

  for (let index = 0; index < root.children.length; index += 1) {
    const child = root.children[index];
    if (!child) continue;
    const updated = insertIntoTree(child, placement, node);
    if (!updated) continue;
    const children = [...root.children];
    children[index] = updated;
    return { ...root, children };
  }
  return null;
}

function removeFromTree(root: UiNode, nodeId: StudioNodeId): UiNode | null {
  if (!root.children) return root;
  const children = root.children.filter((child) => child.id !== nodeId);
  if (children.length !== root.children.length) return { ...root, children };

  for (let index = 0; index < root.children.length; index += 1) {
    const child = root.children[index];
    if (!child) continue;
    const updated = removeFromTree(child, nodeId);
    if (updated === child) continue;
    const nextChildren = [...root.children];
    if (updated) nextChildren[index] = updated;
    return { ...root, children: nextChildren };
  }
  return root;
}
