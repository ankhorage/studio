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

import type { StudioAuthSettings } from './authSettings';

export type {
  ProjectAuthDiagnostic,
  ProjectAuthDiagnosticSeverity,
  ProjectAuthHealth,
  ProjectAuthHealthStatus,
  ProjectOAuthProviderHealth,
  ProjectOAuthProviderHealthStatus,
} from './projectAuthHealth';
export type {
  ProjectSecretUsage,
  ProjectSecretUsageCategory,
  ProjectSecretUsageSummary,
} from './projectSecretUsage';

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
  ],
  doesNotOwn: [
    'generic runtime renderer behavior',
    'generic runtime actions or bindings',
    'Expo runtime planning',
    'generated-app overlay code',
    'template catalog content',
    'root command bus behavior',
    'React Native UI components',
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
export type StudioAdminRoutePath = StudioAdminStaticRoutePath | `/ankh/properties/${string}`;

export type StudioManifest = AppManifest & {
  infra: AppManifest['infra'] & {
    modulesConfig?: Record<string, unknown>;
  };
};

export type ThemeUpdates = Partial<Omit<ThemeConfig, 'light' | 'dark'>> & {
  light?: Partial<ThemeModeConfig>;
  dark?: Partial<ThemeModeConfig>;
};

export interface StudioSelectionState {
  activeScreenId: StudioScreenId | null;
  selectedNodeId: StudioNodeId | null;
  activePanelId: StudioPanelId | null;
  activeAdminRouteId: StudioAdminRouteId;
  activeCanvasDragNodeId: StudioNodeId | null;
}

export interface StudioSessionState {
  projectId: StudioProjectId;
  sessionId?: StudioSessionId;
  activeLocale: StudioLocale;
  studioMode: StudioMode;
  previewMode: boolean;
  lastNonAdminLocation: string;
  saveStatus: StudioSaveStatus;
  isLoading: boolean;
  error: string | null;
}

export type PlacementKind = 'inside' | 'before' | 'after';

export interface NodePlacement {
  parentId: StudioNodeId;
  index: number;
  kind: PlacementKind;
  referenceId?: StudioNodeId;
}

export type PlacementFailureCode =
  | 'missing-root'
  | 'missing-target'
  | 'missing-parent'
  | 'child-not-allowed'
  | 'invalid-index'
  | 'no-valid-target'
  | 'cannot-move-root'
  | 'cannot-move-into-self'
  | 'cannot-move-into-descendant'
  | 'no-op';

export interface PlacementFailureReason {
  code: PlacementFailureCode;
  message: string;
}

export type PlacementValidationResult =
  | { ok: true }
  | {
      ok: false;
      reason: PlacementFailureReason;
    };

export type PlacementResolutionResult =
  | { ok: true; placement: NodePlacement }
  | {
      ok: false;
      reason: PlacementFailureReason;
    };

export type InsertCatalogEntryKind = 'component' | 'recipe';
export type InsertCatalogEntryStatus = 'enabled' | 'disabled';

export type InsertCatalogDisabledReasonCode =
  'missing-meta' | 'invalid-recipe' | 'no-placement' | 'not-direct';

export interface InsertRecipeNode {
  type: string;
  children?: InsertRecipeNode[];
}

export interface InsertRecipe {
  id: string;
  label: string;
  description?: string;
  category: string;
  root: InsertRecipeNode;
}

export interface InsertRecipeIssue {
  code: 'missing-meta' | 'child-not-allowed';
  path: string[];
  nodeType: string;
  childType?: string;
}

export interface InsertCatalogDisabledReason {
  code: InsertCatalogDisabledReasonCode;
  detail: string;
  issue?: InsertRecipeIssue;
}

export interface InsertCatalogEntryBase {
  id: string;
  label: string;
  description?: string;
  category: string;
  rootType: string;
  kind: InsertCatalogEntryKind;
  status: InsertCatalogEntryStatus;
  disabledReason?: InsertCatalogDisabledReason;
  placement?: NodePlacement;
}

export interface InsertCatalogComponentEntry extends InsertCatalogEntryBase {
  kind: 'component';
  componentType: string;
}

export interface InsertCatalogRecipeEntry extends InsertCatalogEntryBase {
  kind: 'recipe';
  recipe: InsertRecipe;
}

export type InsertCatalogEntry = InsertCatalogComponentEntry | InsertCatalogRecipeEntry;

export type StudioActionPayloadPrimitive = 'string' | 'number' | 'boolean' | 'object';

export interface StudioActionPayloadField {
  type: StudioActionPayloadPrimitive;
  label: string;
  required?: boolean;
}

export type StudioActionPayloadSchema = Record<string, StudioActionPayloadField>;

export interface ActionDefinition {
  type: ActionType;
  label: string;
  description: string;
  requiresPayload: boolean;
  payloadSchema?: StudioActionPayloadSchema;
}

export interface ModuleDefinition {
  id: StudioModuleId;
  name: string;
  description: string;
  ui?: {
    modal?: { title: string };
  };
}

export interface StudioComponentBlueprint {
  label?: string;
  defaultProps?: Record<string, unknown>;
}

export interface StudioComponentMeta {
  category: string;
  allowedChildren: readonly string[];
  directManifestNode?: boolean;
  blueprint?: StudioComponentBlueprint;
}

export type StudioComponentMetaRegistry = Record<string, StudioComponentMeta | undefined>;

export type StudioIdGenerator = (prefix?: string) => string;

export type StudioCommand =
  | { type: 'studio.selectNode'; nodeId: StudioNodeId | null }
  | { type: 'studio.setActivePanel'; panelId: StudioPanelId | null }
  | { type: 'studio.setActiveAdminRoute'; routeId: StudioAdminRouteId }
  | { type: 'studio.setActiveCanvasDragNode'; nodeId: StudioNodeId | null }
  | { type: 'studio.setActiveScreen'; screenId: StudioScreenId }
  | { type: 'studio.setStudioMode'; mode: StudioMode }
  | { type: 'studio.togglePreviewMode' };

export type StudioEvent =
  | { type: 'studio.nodeSelected'; nodeId: StudioNodeId | null }
  | { type: 'studio.panelChanged'; panelId: StudioPanelId | null }
  | { type: 'studio.adminRouteChanged'; routePath: StudioAdminRoutePath }
  | { type: 'studio.screenChanged'; screenId: StudioScreenId }
  | { type: 'studio.saveStatusChanged'; status: StudioSaveStatus };

export interface StudioContextValue extends StudioSelectionState, StudioSessionState {
  manifest: StudioManifest | null;
  rootNode: UiNode | null;
  selectNode: (id: StudioNodeId | null) => void;
  setActivePanelId: (panelId: StudioPanelId | null) => void;
  setActiveAdminRouteId: (routeId: StudioAdminRouteId) => void;
  setLastNonAdminLocation: (location: string) => void;
  setActiveCanvasDragNodeId: (nodeId: StudioNodeId | null) => void;
  updateNode: (nodeId: StudioNodeId, props: Record<string, unknown>) => void;
  updateAppData: (data: AppDataManifest) => void;
  updateDataBindings: (dataBindings: ComponentDataBindingRegistry) => void;
  updateDataSources: (dataSources: DataSourceRegistry) => void;
  deleteNode: (id: StudioNodeId) => void;
  insertFromCatalogEntry: (entry: InsertCatalogEntry) => boolean;
  moveNodeToPlacement: (nodeId: StudioNodeId, placement: NodePlacement) => boolean;
  addScreen: (name: string) => void;
  deleteScreen: (id: StudioScreenId) => void;
  setNavigatorType: (type: NavigatorType) => void;
  setNavigatorInitialRoute: (routeName: string) => void;
  addTheme: () => void;
  updateTheme: (id: string, updates: ThemeUpdates) => void;
  deleteTheme: (id: string) => void;
  setActiveThemeId: (id: string) => void;
  setActiveThemeMode: (mode: StudioMode) => void;
  updateAuthSettings: (settings: StudioAuthSettings) => void;
  updateModuleConfig: (moduleId: StudioModuleId, config: Record<string, unknown>) => void;
  updateOAuthProviders: (providers: AuthOAuthProviderConfig[]) => void;
  moveNode: (id: StudioNodeId, direction: 'up' | 'down') => void;
  reorderScreens: (newRoutes: RouteDefinition[]) => void;
  setActiveScreenId: (id: StudioScreenId) => void;
  findNode: (root: UiNode, id: StudioNodeId) => UiNode | null;
  setStudioMode: (mode: StudioMode) => void;
  togglePreviewMode: () => void;
  t: (key: string) => string;
  setActiveLocale: (locale: StudioLocale) => void;
  reloadDictionaries: () => Promise<void>;
  refetchManifest: () => Promise<void>;
  flushManifest: () => Promise<void>;
}

export const ACTION_REGISTRY: Record<ActionType, ActionDefinition> = {
  navigate: {
    type: 'navigate',
    label: 'Navigate',
    description: 'Navigate to another screen or route',
    requiresPayload: true,
    payloadSchema: {
      route: {
        type: 'string',
        label: 'Route',
        required: true,
      },
      params: {
        type: 'object',
        label: 'Parameters',
      },
    },
  },
  alert: {
    type: 'alert',
    label: 'Alert',
    description: 'Show an alert dialog',
    requiresPayload: false,
    payloadSchema: {
      message: {
        type: 'string',
        label: 'Message',
      },
    },
  },
  console: {
    type: 'console',
    label: 'Console Log',
    description: 'Log a message to the console',
    requiresPayload: false,
  },
  toggleDarkMode: {
    type: 'toggleDarkMode',
    label: 'Toggle Dark Mode',
    description: 'Toggle between light and dark theme modes',
    requiresPayload: false,
  },
  setLanguage: {
    type: 'setLanguage',
    label: 'Set Language',
    description: 'Change the application language',
    requiresPayload: true,
    payloadSchema: {
      locale: {
        type: 'string',
        label: 'Locale',
        required: true,
      },
    },
  },
  search: {
    type: 'search',
    label: 'Search',
    description: 'Search for content by text and metadata',
    requiresPayload: true,
    payloadSchema: {
      query: {
        type: 'string',
        label: 'Search Query',
        required: true,
      },
      scope: {
        type: 'string',
        label: 'Search Scope',
      },
    },
  },
  filter: {
    type: 'filter',
    label: 'Filter',
    description: 'Filter content by key-value pairs',
    requiresPayload: true,
    payloadSchema: {
      filterKey: {
        type: 'string',
        label: 'Filter Key',
        required: true,
      },
      filterValue: {
        type: 'string',
        label: 'Filter Value',
        required: true,
      },
    },
  },
};

export const TPL_SCREEN_EMPTY: UiNode = {
  id: 'tpl-screen-empty',
  type: 'Screen',
  props: {
    width: 'wide',
  },
  children: [
    {
      id: 'tpl-screen-empty-header',
      type: 'SectionHeader',
      props: {
        title: 'New Screen',
        description: 'Start authoring with ZORA layouts and patterns.',
      },
    },
    {
      id: 'tpl-screen-empty-section',
      type: 'ScreenSection',
      props: {
        title: 'Build the first section',
        description: 'Insert panels, forms, or content patterns to start authoring.',
      },
      children: [
        {
          id: 'tpl-screen-empty-state',
          type: 'EmptyState',
          props: {
            title: 'Canvas is ready',
            description: 'Use Insert to add components and layouts.',
          },
        },
      ],
    },
    {
      id: 'tpl-screen-empty-action',
      type: 'Button',
      props: {
        children: 'Add first section',
        tone: 'primary',
        emphasis: 'solid',
      },
    },
  ],
};

/**
 * Generates a unique ID for Studio-authored nodes and entities.
 */
export const generateStudioId: StudioIdGenerator = (prefix?: string): string => {
  const timestamp = Date.now().toString(36);
  const random = Math.random().toString(36).substring(2, 11);
  const id = `${timestamp}-${random}`;
  return prefix ? `${prefix.toLowerCase()}-${id}` : id;
};

export const cloneWithNewIds = (
  node: UiNode,
  createId: StudioIdGenerator = generateStudioId,
): UiNode => {
  const clonedNode: UiNode = {
    ...node,
    id: createId(node.type),
    props: node.props ? { ...node.props } : node.props,
  };

  if (node.children) {
    clonedNode.children = node.children.map((child) => cloneWithNewIds(child, createId));
  }

  return clonedNode;
};

export const findNodeById = (root: UiNode, id: string): UiNode | null => {
  if (root.id === id) return root;
  if (!root.children) return null;

  for (const child of root.children) {
    const found = findNodeById(child, id);
    if (found) return found;
  }

  return null;
};

export const updateNodeInTree = (
  root: UiNode,
  id: string,
  newProps: Record<string, unknown>,
): UiNode => {
  if (root.id === id) {
    const { alias, style, ...rest } = newProps;
    const aliasUpdate = typeof alias === 'string' ? { alias } : {};
    const styleUpdate = isStyleRecord(style) ? { style } : {};

    return {
      ...root,
      ...aliasUpdate,
      ...styleUpdate,
      props: { ...(root.props ?? {}), ...rest },
    };
  }

  if (!root.children) {
    return root;
  }

  return {
    ...root,
    children: root.children.map((child) => updateNodeInTree(child, id, newProps)),
  };
};

export const removeNodeFromTree = (root: UiNode, nodeId: string): UiNode | null => {
  if (root.id === nodeId) return null;

  if (!root.children) {
    return root;
  }

  const filteredChildren = root.children.filter((child) => child.id !== nodeId);
  if (filteredChildren.length !== root.children.length) {
    return { ...root, children: filteredChildren };
  }

  const nextChildren = root.children.map((child) => removeNodeFromTree(child, nodeId) ?? child);
  const hasChanged = nextChildren.some((child, index) => child !== root.children?.[index]);

  return hasChanged ? { ...root, children: nextChildren } : root;
};

export const addNodeToTree = (args: {
  root: UiNode;
  targetId: string;
  newNode: UiNode;
  componentMeta: StudioComponentMetaRegistry;
  mode?: 'append' | 'prepend';
}): UiNode => {
  const { root, targetId, newNode, componentMeta, mode = 'append' } = args;

  if (root.id === targetId) {
    if (!canAcceptChild({ parentType: root.type, childType: newNode.type, componentMeta })) {
      return root;
    }

    const children = root.children ?? [];
    return {
      ...root,
      children: mode === 'prepend' ? [newNode, ...children] : [...children, newNode],
    };
  }

  if (!root.children) {
    return root;
  }

  const nextChildren = root.children.map((child) =>
    addNodeToTree({ root: child, targetId, newNode, componentMeta, mode }),
  );
  const hasChanged = nextChildren.some((child, index) => child !== root.children?.[index]);

  return hasChanged ? { ...root, children: nextChildren } : root;
};

export const moveNodeInTree = (root: UiNode, nodeId: string, direction: 'up' | 'down'): UiNode => {
  if (root.id === nodeId || !root.children) return root;

  const index = root.children.findIndex((child) => child.id === nodeId);
  if (index !== -1) {
    const targetIndex = direction === 'up' ? index - 1 : index + 1;
    if (targetIndex < 0 || targetIndex >= root.children.length) {
      return root;
    }

    const currentNode = root.children[index];
    const targetNode = root.children[targetIndex];
    if (!currentNode || !targetNode) {
      return root;
    }

    const nextChildren = [...root.children];
    nextChildren[index] = targetNode;
    nextChildren[targetIndex] = currentNode;
    return { ...root, children: nextChildren };
  }

  const nextChildren = root.children.map((child) => moveNodeInTree(child, nodeId, direction));
  const hasChanged = nextChildren.some(
    (child, childIndex) => child !== root.children?.[childIndex],
  );

  return hasChanged ? { ...root, children: nextChildren } : root;
};

interface NodeWithParent {
  node: UiNode;
  parent: UiNode | null;
  index: number;
}

function findNodeWithParent(root: UiNode, nodeId: string): NodeWithParent | null {
  if (root.id === nodeId) {
    return { node: root, parent: null, index: -1 };
  }

  const visit = (node: UiNode): NodeWithParent | null => {
    const children = node.children ?? [];
    for (const [index, child] of children.entries()) {
      if (child.id === nodeId) {
        return { node: child, parent: node, index };
      }

      const nested = visit(child);
      if (nested) {
        return nested;
      }
    }

    return null;
  };

  return visit(root);
}

function isDescendantNode(node: UiNode, descendantId: string): boolean {
  const children = node.children ?? [];
  for (const child of children) {
    if (child.id === descendantId || isDescendantNode(child, descendantId)) {
      return true;
    }
  }

  return false;
}

function removeNodeForMove(args: { node: UiNode; nodeId: string }): {
  node: UiNode;
  removedNode: UiNode | null;
} {
  const { node, nodeId } = args;
  const children = node.children ?? [];
  const directIndex = children.findIndex((child) => child.id === nodeId);

  if (directIndex !== -1) {
    const removedNode = children[directIndex];
    if (!removedNode) {
      return { node, removedNode: null };
    }

    return {
      node: {
        ...node,
        children: children.filter((child) => child.id !== nodeId),
      },
      removedNode,
    };
  }

  const nextChildren: UiNode[] = [];
  let removedNode: UiNode | null = null;

  for (const child of children) {
    if (removedNode) {
      nextChildren.push(child);
      continue;
    }

    const { node: nextChild, removedNode: nextRemovedNode } = removeNodeForMove({
      node: child,
      nodeId,
    });
    if (nextRemovedNode) {
      removedNode = nextRemovedNode;
    }
    nextChildren.push(nextChild);
  }

  if (!removedNode) {
    return { node, removedNode: null };
  }

  return {
    node: {
      ...node,
      children: nextChildren,
    },
    removedNode,
  };
}

export function canAcceptChild(args: {
  parentType: string;
  childType: string;
  componentMeta: StudioComponentMetaRegistry;
}): boolean {
  const { parentType, childType, componentMeta } = args;
  const meta = componentMeta[parentType];
  if (!meta) return false;

  return meta.allowedChildren.includes(childType);
}

export function validateNodePlacement(args: {
  root: UiNode;
  placement: NodePlacement;
  childType: string;
  componentMeta: StudioComponentMetaRegistry;
}): PlacementValidationResult {
  const { root, placement, childType, componentMeta } = args;
  const parent = findNodeById(root, placement.parentId);
  if (!parent) {
    return {
      ok: false,
      reason: {
        code: 'missing-parent',
        message: `Parent node ${placement.parentId} was not found.`,
      },
    };
  }

  if (!canAcceptChild({ parentType: parent.type, childType, componentMeta })) {
    return {
      ok: false,
      reason: {
        code: 'child-not-allowed',
        message: `Parent ${parent.type} does not allow ${childType} children.`,
      },
    };
  }

  const children = parent.children ?? [];
  if (placement.referenceId) {
    const hasReference = children.some((child) => child.id === placement.referenceId);
    if (!hasReference) {
      return {
        ok: false,
        reason: {
          code: 'missing-target',
          message: `Reference node ${placement.referenceId} was not found under ${parent.id}.`,
        },
      };
    }
  }

  if (placement.index < 0 || placement.index > children.length) {
    return {
      ok: false,
      reason: {
        code: 'invalid-index',
        message: `Index ${placement.index} is out of bounds for ${parent.id}.`,
      },
    };
  }

  return { ok: true };
}

export function resolveInsertPlacement(args: {
  root: UiNode;
  targetNodeId: string;
  childType: string;
  componentMeta: StudioComponentMetaRegistry;
  kind: PlacementKind;
}): PlacementResolutionResult {
  const { root, targetNodeId, childType, componentMeta, kind } = args;
  const target = findNodeWithParent(root, targetNodeId);
  if (!target) {
    return {
      ok: false,
      reason: {
        code: 'missing-target',
        message: `Target node ${targetNodeId} was not found.`,
      },
    };
  }

  if (kind === 'inside') {
    const parent = target.node;
    const children = parent.children ?? [];
    const placement: NodePlacement = {
      parentId: parent.id,
      index: children.length,
      kind,
    };
    const validation = validateNodePlacement({ root, placement, childType, componentMeta });
    if (!validation.ok) {
      return validation;
    }

    return { ok: true, placement };
  }

  const { parent } = target;
  if (!parent) {
    return {
      ok: false,
      reason: {
        code: 'missing-parent',
        message: `Target node ${targetNodeId} has no parent.`,
      },
    };
  }

  const index = kind === 'before' ? target.index : target.index + 1;
  const placement: NodePlacement = {
    parentId: parent.id,
    index,
    kind,
    referenceId: target.node.id,
  };
  const validation = validateNodePlacement({ root, placement, childType, componentMeta });
  if (!validation.ok) {
    return validation;
  }

  return { ok: true, placement };
}

export function resolveDefaultInsertPlacement(args: {
  root: UiNode;
  selectedNodeId: string | null;
  childType: string;
  componentMeta: StudioComponentMetaRegistry;
}): PlacementResolutionResult {
  const { root, selectedNodeId, childType, componentMeta } = args;
  if (selectedNodeId) {
    const inside = resolveInsertPlacement({
      root,
      targetNodeId: selectedNodeId,
      childType,
      componentMeta,
      kind: 'inside',
    });
    if (inside.ok) return inside;

    const after = resolveInsertPlacement({
      root,
      targetNodeId: selectedNodeId,
      childType,
      componentMeta,
      kind: 'after',
    });
    if (after.ok) return after;
  }

  const atRoot = resolveInsertPlacement({
    root,
    targetNodeId: root.id,
    childType,
    componentMeta,
    kind: 'inside',
  });
  if (atRoot.ok) return atRoot;

  return {
    ok: false,
    reason: {
      code: 'no-valid-target',
      message: `No valid insertion target found for ${childType}.`,
    },
  };
}

export interface InsertNodeAtPlacementArgs {
  root: UiNode;
  placement: NodePlacement;
  componentMeta: StudioComponentMetaRegistry;
  makeNode: () => UiNode;
}

export interface InsertNodeAtPlacementResult {
  root: UiNode;
  insertedNodeId: string;
}

function insertChildAtIndex(args: {
  node: UiNode;
  parentId: string;
  index: number;
  newNode: UiNode;
}): { node: UiNode; inserted: boolean } {
  const { node, parentId, index, newNode } = args;
  if (node.id === parentId) {
    const children = node.children ?? [];
    if (index < 0 || index > children.length) {
      return { node, inserted: false };
    }

    const nextChildren = [...children.slice(0, index), newNode, ...children.slice(index)];
    return {
      node: {
        ...node,
        children: nextChildren,
      },
      inserted: true,
    };
  }

  if (!node.children || node.children.length === 0) {
    return { node, inserted: false };
  }

  const results = node.children.map((child) =>
    insertChildAtIndex({ node: child, parentId, index, newNode }),
  );
  const inserted = results.some((result) => result.inserted);

  if (!inserted) {
    return { node, inserted: false };
  }

  return {
    node: {
      ...node,
      children: results.map((result) => result.node),
    },
    inserted: true,
  };
}

export function insertNodeAtPlacement(
  args: InsertNodeAtPlacementArgs,
): InsertNodeAtPlacementResult | null {
  const { root, placement, componentMeta, makeNode } = args;
  const newNode = makeNode();
  const validation = validateNodePlacement({
    root,
    placement,
    childType: newNode.type,
    componentMeta,
  });

  if (!validation.ok) {
    return null;
  }

  const result = insertChildAtIndex({
    node: root,
    parentId: placement.parentId,
    index: placement.index,
    newNode,
  });
  if (!result.inserted) return null;

  return { root: result.node, insertedNodeId: newNode.id };
}

export interface MoveNodeToPlacementArgs {
  root: UiNode;
  nodeId: string;
  placement: NodePlacement;
  componentMeta: StudioComponentMetaRegistry;
}

export interface MoveNodeToPlacementResult {
  root: UiNode;
  movedNodeId: string;
}

function getAdjustedMovePlacement(args: {
  source: NodeWithParent;
  placement: NodePlacement;
}): NodePlacement | null {
  const { source, placement } = args;
  if (!source.parent) {
    return null;
  }

  if (placement.referenceId === source.node.id) {
    return null;
  }

  const sourceParentId = source.parent.id;
  if (placement.parentId !== sourceParentId) {
    return placement;
  }

  const adjustedIndex = source.index < placement.index ? placement.index - 1 : placement.index;
  if (adjustedIndex === source.index) {
    return null;
  }

  return {
    ...placement,
    index: adjustedIndex,
  };
}

export function moveNodeToPlacement(
  args: MoveNodeToPlacementArgs,
): MoveNodeToPlacementResult | null {
  const { root, nodeId, placement, componentMeta } = args;
  const source = findNodeWithParent(root, nodeId);
  if (!source) {
    return null;
  }

  if (!source.parent) {
    return null;
  }

  if (placement.parentId === nodeId) {
    return null;
  }

  if (isDescendantNode(source.node, placement.parentId)) {
    return null;
  }

  const adjustedPlacement = getAdjustedMovePlacement({ source, placement });
  if (!adjustedPlacement) {
    return null;
  }

  const removed = removeNodeForMove({ node: root, nodeId });
  if (!removed.removedNode) {
    return null;
  }

  const validation = validateNodePlacement({
    root: removed.node,
    placement: adjustedPlacement,
    childType: removed.removedNode.type,
    componentMeta,
  });
  if (!validation.ok) {
    return null;
  }

  const inserted = insertChildAtIndex({
    node: removed.node,
    parentId: adjustedPlacement.parentId,
    index: adjustedPlacement.index,
    newNode: removed.removedNode,
  });
  if (!inserted.inserted) {
    return null;
  }

  return {
    root: inserted.node,
    movedNodeId: removed.removedNode.id,
  };
}

const CATEGORY_LABELS: Record<string, string> = {
  layout: 'Layouts',
  pattern: 'Patterns',
  component: 'Components',
  foundation: 'Foundation',
  recipe: 'Recipes',
};

const CATEGORY_ORDER = ['layout', 'pattern', 'component', 'foundation', 'recipe'] as const;

export const STUDIO_INSERT_RECIPES: readonly InsertRecipe[] = [
  {
    id: 'screen-section',
    label: 'Screen section',
    description: 'A screen section with a starter heading.',
    category: 'recipe',
    root: {
      type: 'ScreenSection',
      children: [{ type: 'Heading' }],
    },
  },
  {
    id: 'panel-stack',
    label: 'Panel stack',
    description: 'Panel with a stack starter.',
    category: 'recipe',
    root: {
      type: 'Panel',
      children: [{ type: 'Stack' }],
    },
  },
  {
    id: 'card-heading',
    label: 'Card heading',
    description: 'Card with a headline.',
    category: 'recipe',
    root: {
      type: 'Card',
      children: [{ type: 'Heading' }],
    },
  },
];

export function getInsertCatalogCategoryLabel(category: string): string {
  return CATEGORY_LABELS[category] ?? category;
}

function resolveCategoryOrder(category: string): number {
  const index = CATEGORY_ORDER.indexOf(category as (typeof CATEGORY_ORDER)[number]);
  return index === -1 ? CATEGORY_ORDER.length : index;
}

function describeInsertRecipeIssue(issue: InsertRecipeIssue): string {
  if (issue.code === 'missing-meta') {
    return `Missing component metadata for ${issue.nodeType}.`;
  }

  return `Child ${issue.childType ?? 'unknown'} is not allowed under ${issue.nodeType}.`;
}

export function validateInsertRecipe(
  recipe: InsertRecipe,
  componentMeta: StudioComponentMetaRegistry,
): InsertRecipeIssue | null {
  const visit = (node: InsertRecipeNode, path: string[]): InsertRecipeIssue | null => {
    const meta = componentMeta[node.type];
    if (!meta) {
      return {
        code: 'missing-meta',
        path,
        nodeType: node.type,
      };
    }

    const children = node.children ?? [];
    for (const child of children) {
      if (!meta.allowedChildren.includes(child.type)) {
        return {
          code: 'child-not-allowed',
          path,
          nodeType: node.type,
          childType: child.type,
        };
      }

      const nested = visit(child, [...path, child.type]);
      if (nested) {
        return nested;
      }
    }

    return null;
  };

  return visit(recipe.root, [recipe.root.type]);
}

function createNodeFromRecipe(
  recipe: InsertRecipe,
  componentMeta: StudioComponentMetaRegistry,
  createId: StudioIdGenerator,
): UiNode {
  const buildNode = (node: InsertRecipeNode): UiNode => {
    const meta = componentMeta[node.type];
    const defaultProps = meta?.blueprint?.defaultProps;

    return {
      id: createId(node.type),
      type: node.type,
      props: defaultProps ? { ...defaultProps } : {},
      children: (node.children ?? []).map(buildNode),
    };
  };

  return buildNode(recipe.root);
}

export function createNodeFromCatalogEntry(
  entry: InsertCatalogEntry,
  componentMeta: StudioComponentMetaRegistry,
  createId: StudioIdGenerator = generateStudioId,
): UiNode {
  if (entry.kind === 'recipe') {
    return createNodeFromRecipe(entry.recipe, componentMeta, createId);
  }

  const meta = componentMeta[entry.componentType];
  const defaultProps = meta?.blueprint?.defaultProps;

  return {
    id: createId(entry.componentType),
    type: entry.componentType,
    props: defaultProps ? { ...defaultProps } : {},
    children: [],
  };
}

function createComponentEntry(
  componentType: string,
  meta: StudioComponentMeta,
): InsertCatalogComponentEntry {
  const isDirect = meta.directManifestNode === true;

  return {
    id: `component:${componentType}`,
    label: meta.blueprint?.label ?? componentType,
    category: meta.category,
    rootType: componentType,
    kind: 'component',
    componentType,
    status: isDirect ? 'enabled' : 'disabled',
    disabledReason: isDirect
      ? undefined
      : {
          code: 'not-direct',
          detail: 'Not a direct manifest node.',
        },
  };
}

function createRecipeEntry(
  recipe: InsertRecipe,
  componentMeta: StudioComponentMetaRegistry,
): InsertCatalogRecipeEntry {
  const issue = validateInsertRecipe(recipe, componentMeta);
  if (issue) {
    const code: InsertCatalogDisabledReasonCode =
      issue.code === 'missing-meta' ? 'missing-meta' : 'invalid-recipe';

    return {
      id: `recipe:${recipe.id}`,
      label: recipe.label,
      description: recipe.description,
      category: 'recipe',
      rootType: recipe.root.type,
      kind: 'recipe',
      recipe,
      status: 'disabled',
      disabledReason: {
        code,
        detail: describeInsertRecipeIssue(issue),
        issue,
      },
    };
  }

  return {
    id: `recipe:${recipe.id}`,
    label: recipe.label,
    description: recipe.description,
    category: 'recipe',
    rootType: recipe.root.type,
    kind: 'recipe',
    recipe,
    status: 'enabled',
  };
}

export function buildInsertCatalogEntries(args: {
  componentMeta: StudioComponentMetaRegistry;
  recipes?: readonly InsertRecipe[];
}): InsertCatalogEntry[] {
  const { componentMeta, recipes = STUDIO_INSERT_RECIPES } = args;
  const componentEntries: InsertCatalogComponentEntry[] = [];

  for (const [type, meta] of Object.entries(componentMeta)) {
    if (meta) {
      componentEntries.push(createComponentEntry(type, meta));
    }
  }

  const recipeEntries = recipes.map((recipe) => createRecipeEntry(recipe, componentMeta));

  return [...componentEntries, ...recipeEntries].sort((left, right) => {
    const leftOrder = resolveCategoryOrder(left.category);
    const rightOrder = resolveCategoryOrder(right.category);
    if (leftOrder !== rightOrder) {
      return leftOrder - rightOrder;
    }

    return left.label.localeCompare(right.label);
  });
}

function resolvePlacementForEntry(args: {
  entry: InsertCatalogEntry;
  root: UiNode;
  selectedNodeId: string | null;
  componentMeta: StudioComponentMetaRegistry;
}): PlacementResolutionResult {
  const { entry, root, selectedNodeId, componentMeta } = args;

  return resolveDefaultInsertPlacement({
    root,
    selectedNodeId,
    childType: entry.rootType,
    componentMeta,
  });
}

export function resolveInsertCatalogEntries(args: {
  entries: readonly InsertCatalogEntry[];
  root: UiNode | null;
  selectedNodeId: string | null;
  componentMeta: StudioComponentMetaRegistry;
}): InsertCatalogEntry[] {
  const { entries, root, selectedNodeId, componentMeta } = args;

  return entries.map((entry) => {
    if (entry.status === 'disabled') {
      return entry;
    }

    if (!root) {
      return {
        ...entry,
        status: 'disabled',
        disabledReason: {
          code: 'no-placement',
          detail: 'No active screen available.',
        },
      };
    }

    const placement = resolvePlacementForEntry({
      entry,
      root,
      selectedNodeId,
      componentMeta,
    });
    if (!placement.ok) {
      return {
        ...entry,
        status: 'disabled',
        disabledReason: {
          code: 'no-placement',
          detail: placement.reason.message,
        },
      };
    }

    return {
      ...entry,
      status: 'enabled',
      placement: placement.placement,
    };
  });
}

function isStyleRecord(value: unknown): value is Record<string, string | number> {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) return false;

  return Object.values(value).every(
    (entry) => typeof entry === 'string' || typeof entry === 'number',
  );
}
