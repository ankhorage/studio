import type {
  ActionType,
  AppManifest,
  AuthOAuthProviderConfig,
  ComponentDataBindingRegistry,
  DataSourceRegistry,
  MediaAsset,
  NavigatorType,
  ThemeConfig,
  ThemeModeConfig,
  UiNode,
} from '@ankhorage/contracts';
import { createCompactId as createUtilityCompactId } from '@ankhorage/utility/id';
import {
  findTreeNode,
  findTreeNodeWithParent,
  isTreeDescendant,
  removeTreeNode,
  type TreeAdapter,
  updateTreeNode,
} from '@ankhorage/utility/tree';

export type {
  StudioModuleAdminContribution,
  StudioModuleAdminControl,
  StudioModuleAdminField,
  StudioModuleOperationResult,
  StudioModuleState,
} from './moduleAdminContracts';

import type { StudioAuthSettings, StudioAuthSettingsMutation } from './authSettings';
import type { StudioMediaDeleteResult } from './mediaAuthoringModel';
import type {
  StudioMediaIngestResult,
  StudioMediaIngestTarget,
  StudioMediaPickerSource,
} from './mediaPickerAuthoring';

const uiNodeTreeAdapter: TreeAdapter<UiNode> = {
  getId: (node) => node.id,
  getChildren: (node) => node.children,
  withChildren: (node, children) => {
    if (children.length === 0 && node.children === undefined) return { ...node };
    return { ...node, children: [...children] };
  },
};

export * from './bindingAuthoringModel';
export * from './mediaAuthoringModel';
export * from './mediaPickerAuthoring';
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

/***
 * @todo Make `src/index.ts` a public exports-only entrypoint. Package metadata, authoring contracts, tree editing, placement policy, templates and insert-catalog implementations need canonical owner modules and should only be re-exported here.
 */
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
    '@ankhorage/deploy',
    '@ankhorage/runtime',
    '@ankhorage/expo-runtime',
    '@ankhorage/orchestrator',
    'standalone module-owned host contributions',
    '@ankhorage/templates',
    '@ankhorage/ankh',
  ],
  doesNotOwn: [
    'generic runtime renderer behavior',
    'generic runtime actions or bindings',
    'Expo runtime planning',
    'generated-app runtime composition code',
    'template catalog content',
    'module lifecycle, ledger, config normalization, or generated output ownership',
    'module-specific administration behavior',
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
  'StudioInstancePropertyField',
  'listStudioMediaAssets',
  'createStudioMediaAssetReference',
  'removeStudioMediaAsset',
  'StudioMediaDeleteResult',
  'StudioMediaPickerAdapter',
  'resolveStudioInstancePropertyGroups',
  'createStudioInstancePropertyPatch',
  'resolveStudioBindableProps',
  'resolveStudioBindableEvents',
  'collectStudioBindingOperationOptions',
  'ProjectAuthHealth',
  'ProjectSecretUsageSummary',
  'StudioAdminRouteId',
  'StudioAdminRoutePath',
  'StudioModuleAdminContribution',
  'StudioModuleOperationResult',
  'StudioModuleState',
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

export type StudioSaveStatus = 'idle' | 'saving' | 'saved' | 'error';
export type StudioPanelId = 'layers';
export type StudioAdminRouteId =
  | 'overview'
  | 'screens'
  | 'screen-detail'
  | 'media'
  | 'modules'
  | 'module-detail'
  | 'apis'
  | 'api-catalog'
  | 'api-operations'
  | 'auth'
  | 'auth-providers'
  | 'auth-routes'
  | 'auth-profile'
  | 'secrets'
  | 'deploy'
  | 'theme'
  | 'theme-colors'
  | 'theme-typography'
  | 'theme-spacing'
  | 'theme-radii'
  | 'theme-shadows'
  | 'theme-component'
  | 'theme-pattern'
  | 'bindings'
  | 'properties';
export type StudioAdminStaticRoutePath =
  | '/ankh'
  | '/ankh/screens'
  | '/ankh/media'
  | '/ankh/modules'
  | '/ankh/apis'
  | '/ankh/apis/catalog'
  | '/ankh/apis/operations'
  | '/ankh/auth'
  | '/ankh/auth/providers'
  | '/ankh/auth/routes'
  | '/ankh/auth/profile'
  | '/ankh/secrets'
  | '/ankh/deploy'
  | '/ankh/theme'
  | '/ankh/theme/colors'
  | '/ankh/theme/typography'
  | '/ankh/theme/spacing'
  | '/ankh/theme/radii'
  | '/ankh/theme/shadows';
export type StudioAdminRoutePath =
  | StudioAdminStaticRoutePath
  | `/ankh/screens/${string}`
  | `/ankh/modules/${string}`
  | `/ankh/theme/components/${string}`
  | `/ankh/theme/patterns/${string}`
  | `/ankh/bindings/${string}`
  | `/ankh/properties/${string}`;

export type StudioManifest = AppManifest;

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
  | 'invalid-reference'
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
  componentMeta: StudioComponentMetaRegistry;
  selectNode: (id: StudioNodeId | null) => void;
  setActivePanelId: (panelId: StudioPanelId | null) => void;
  setActiveAdminRouteId: (routeId: StudioAdminRouteId) => void;
  setLastNonAdminLocation: (location: string) => void;
  setActiveCanvasDragNodeId: (nodeId: StudioNodeId | null) => void;
  updateNode: (nodeId: StudioNodeId, props: Record<string, unknown>) => void;
  upsertMediaAsset: (asset: MediaAsset) => void;
  removeMediaAsset: (mediaId: string) => boolean;
  deleteMediaAsset: (mediaId: string) => Promise<StudioMediaDeleteResult>;
  mediaPickerAvailable: boolean;
  ingestMediaFromPicker: (
    source: StudioMediaPickerSource,
    target?: StudioMediaIngestTarget,
  ) => Promise<StudioMediaIngestResult>;
  updateDataBindings: (dataBindings: ComponentDataBindingRegistry) => void;
  updateDataSources: (dataSources: DataSourceRegistry) => void;
  deleteNode: (id: StudioNodeId) => void;
  insertFromCatalogEntry: (entry: InsertCatalogEntry) => boolean;
  moveNodeToPlacement: (nodeId: StudioNodeId, placement: NodePlacement) => boolean;
  addScreen: (name: string) => void;
  deleteScreen: (id: StudioScreenId) => void;
  setNavigatorType: (type: NavigatorType) => void;
  setNavigatorInitialRoute: (routeName: string) => void;
  setRoutePrimaryNavigationVisibility: (
    parentPath: string[],
    routeName: string,
    showInPrimaryNavigation: boolean,
  ) => void;
  moveRoute: (parentPath: string[], routeName: string, toIndex: number) => void;
  addTheme: () => void;
  updateTheme: (id: string, updates: ThemeUpdates) => void;
  deleteTheme: (id: string) => void;
  setActiveThemeId: (id: string) => void;
  updateAuthSettings: (settings: StudioAuthSettings) => void;
  mutateAuthSettings: (mutation: StudioAuthSettingsMutation) => StudioAuthSettings | null;
  updateOAuthProviders: (providers: AuthOAuthProviderConfig[]) => void;
  setActiveScreenId: (id: StudioScreenId) => void;
  findNode: (root: UiNode, id: StudioNodeId) => UiNode | null;
  togglePreviewMode: () => void;
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

/***
 * Generate a compact time/random identifier with an optional lowercase prefix.
 * @utility @ankhorage/utility/id
 * @todo Move the Studio-facing wrapper out of `src/index.ts`; the reusable identifier primitive belongs in Utility.
 */
export const generateStudioId: StudioIdGenerator = (prefix?: string): string => {
  return createUtilityCompactId(prefix?.toLowerCase() ?? '', { randomLength: 9 });
};

/***
 * Deep-clone a UiNode tree while assigning fresh identifiers and shallow-cloning node props.
 * @utility @ankhorage/utility/tree
 * @todo `cloneTreeWithNewIds` currently allocates child ids before the root; retain this public pre-order callback contract until Utility supports configurable traversal order.
 */
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

/***
 * Find the first node with a matching id in a depth-first tree traversal.
 * @utility @ankhorage/utility/tree
 * @todo Move the UiNode wrapper out of `src/index.ts`; parameterize id and child accessors for Utility.
 */
export const findNodeById = (root: UiNode, id: string): UiNode | null => {
  return findTreeNode(root, id, uiNodeTreeAdapter) ?? null;
};

/***
 * Immutably update one UiNode by id while preserving Studio's alias/style versus props patch semantics.
 * @utility @ankhorage/utility/tree
 * @todo Keep Studio-specific patch projection in the canvas/properties owner and extract the generic immutable tree-update primitive to Utility.
 */
export const updateNodeInTree = (
  root: UiNode,
  id: string,
  newProps: Record<string, unknown>,
): UiNode => {
  return updateTreeNode(
    root,
    id,
    (node) => {
      const { alias, style, ...rest } = newProps;
      const aliasUpdate = typeof alias === 'string' ? { alias } : {};
      const styleUpdate = isStyleRecord(style) ? { style } : {};
      return {
        ...node,
        ...aliasUpdate,
        ...styleUpdate,
        props: { ...(node.props ?? {}), ...rest },
      };
    },
    uiNodeTreeAdapter,
  );
};

/***
 * Immutably remove a node by id from a UiNode tree and preserve unchanged branches by reference.
 * @utility @ankhorage/utility/tree
 * @todo Move the UiNode wrapper out of `src/index.ts` and parameterize tree accessors for Utility.
 */
export const removeNodeFromTree = (root: UiNode, nodeId: string): UiNode | null => {
  return removeTreeNode(root, nodeId, uiNodeTreeAdapter) ?? null;
};

interface NodeWithParent {
  node: UiNode;
  parent: UiNode | null;
  index: number;
}

/***
 * Find a node together with its parent and sibling index in a depth-first traversal.
 * @utility @ankhorage/utility/tree
 */
function findNodeWithParent(root: UiNode, nodeId: string): NodeWithParent | null {
  return findTreeNodeWithParent(root, nodeId, uiNodeTreeAdapter) ?? null;
}

/***
 * Return whether a node tree contains a descendant with the requested id.
 * @utility @ankhorage/utility/tree
 */
function isDescendantNode(node: UiNode, descendantId: string): boolean {
  return isTreeDescendant(node, node.id, descendantId, uiNodeTreeAdapter);
}

/***
 * Immutably remove one node from a tree and return both the next tree and removed node for move operations.
 * @utility @ankhorage/utility/tree
 */
function removeNodeForMove(args: { node: UiNode; nodeId: string }): {
  node: UiNode;
  removedNode: UiNode | null;
} {
  const { node, nodeId } = args;
  const children = node.children ?? [];
  const directIndex = children.findIndex((child) => child.id === nodeId);

  if (directIndex !== -1) {
    const removedNode = children.at(directIndex);
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

/***
 * Return whether Studio component metadata permits one child type under a parent type.
 * @todo Move this component-placement policy from `src/index.ts` into the `canvas/` or insert-authoring domain.
 */
export function canAcceptChild(args: {
  parentType: string;
  childType: string;
  componentMeta: StudioComponentMetaRegistry;
}): boolean {
  const { parentType, childType, componentMeta } = args;
  const meta = Object.entries(componentMeta).find(([type]) => type === parentType)?.[1];
  if (!meta) return false;

  return meta.allowedChildren.includes(childType);
}

/***
 * Validate one resolved Studio placement against parent existence, child policy, index bounds and sibling-reference invariants.
 * @todo Move placement validation from the public entrypoint into the `canvas/` domain.
 */
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
  if (placement.index < 0 || placement.index > children.length) {
    return {
      ok: false,
      reason: {
        code: 'invalid-index',
        message: `Index ${placement.index} is out of bounds for ${parent.id}.`,
      },
    };
  }

  if (placement.kind === 'inside') {
    if (placement.referenceId) {
      return {
        ok: false,
        reason: {
          code: 'invalid-reference',
          message: 'Inside placements cannot include a sibling reference.',
        },
      };
    }
    return { ok: true };
  }

  if (!placement.referenceId) {
    return {
      ok: false,
      reason: {
        code: 'invalid-reference',
        message: `${placement.kind} placements require a sibling reference.`,
      },
    };
  }

  const referenceIndex = children.findIndex((child) => child.id === placement.referenceId);
  if (referenceIndex === -1) {
    return {
      ok: false,
      reason: {
        code: 'missing-target',
        message: `Reference node ${placement.referenceId} was not found under ${parent.id}.`,
      },
    };
  }

  const expectedIndex = placement.kind === 'before' ? referenceIndex : referenceIndex + 1;
  if (placement.index !== expectedIndex) {
    return {
      ok: false,
      reason: {
        code: 'invalid-index',
        message: `${placement.kind} placement index ${placement.index} does not match reference ${placement.referenceId}.`,
      },
    };
  }

  return { ok: true };
}

/***
 * Resolve a requested inside/before/after insertion target to a validated Studio placement.
 * @todo Move insertion-placement policy from `src/index.ts` into the `canvas/`/insert domain.
 */
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

/***
 * Resolve the preferred insertion placement by trying the selected node, its sibling position, then the screen root.
 * @todo Move Studio default insertion policy from `src/index.ts` into the insert/canvas domain.
 */
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

/***
 * Immutably insert a child at a requested parent/index anywhere in a tree and report whether insertion occurred.
 * @utility @ankhorage/utility/tree
 */
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

/***
 * Create and insert one Studio node after validating its requested placement.
 * @todo Move Studio insertion orchestration from `src/index.ts` into the insert/canvas domain.
 */
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

/***
 * Adjust a target placement for removal-induced index shifts and reject no-op/self-reference moves.
 * @todo Keep this placement-specific policy in the canvas domain.
 */
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

/***
 * Validate and resolve a requested Studio node move after accounting for source removal and descendant/no-op invariants.
 * @todo Move node-move policy from `src/index.ts` into the canvas domain.
 */
export function resolveMoveNodePlacement(args: MoveNodeToPlacementArgs): PlacementResolutionResult {
  const { root, nodeId, placement, componentMeta } = args;
  const source = findNodeWithParent(root, nodeId);
  if (!source) {
    return {
      ok: false,
      reason: { code: 'missing-target', message: `Node ${nodeId} was not found.` },
    };
  }

  if (!source.parent) {
    return {
      ok: false,
      reason: { code: 'cannot-move-root', message: 'The active screen root cannot be moved.' },
    };
  }

  if (placement.parentId === nodeId) {
    return {
      ok: false,
      reason: { code: 'cannot-move-into-self', message: 'A node cannot be moved inside itself.' },
    };
  }

  if (isDescendantNode(source.node, placement.parentId)) {
    return {
      ok: false,
      reason: {
        code: 'cannot-move-into-descendant',
        message: 'A node cannot be moved into one of its descendants.',
      },
    };
  }

  if (placement.referenceId === nodeId) {
    return {
      ok: false,
      reason: { code: 'no-op', message: 'The node is already at that location.' },
    };
  }

  const adjustedPlacement = getAdjustedMovePlacement({ source, placement });
  if (!adjustedPlacement) {
    return {
      ok: false,
      reason: { code: 'no-op', message: 'The node is already at that location.' },
    };
  }

  const removed = removeNodeForMove({ node: root, nodeId });
  if (!removed.removedNode) {
    return {
      ok: false,
      reason: { code: 'missing-target', message: `Node ${nodeId} could not be removed.` },
    };
  }

  const validation = validateNodePlacement({
    root: removed.node,
    placement: adjustedPlacement,
    childType: removed.removedNode.type,
    componentMeta,
  });
  if (!validation.ok) return validation;

  return { ok: true, placement: adjustedPlacement };
}

/***
 * Execute a validated Studio node move as immutable removal followed by insertion.
 * @todo Move node-move orchestration from `src/index.ts` into the canvas domain.
 */
export function moveNodeToPlacement(
  args: MoveNodeToPlacementArgs,
): MoveNodeToPlacementResult | null {
  const { root, nodeId, placement, componentMeta } = args;
  const resolution = resolveMoveNodePlacement({ root, nodeId, placement, componentMeta });
  if (!resolution.ok) return null;

  const removed = removeNodeForMove({ node: root, nodeId });
  if (!removed.removedNode) {
    return null;
  }

  const inserted = insertChildAtIndex({
    node: removed.node,
    parentId: resolution.placement.parentId,
    index: resolution.placement.index,
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

/***
 * Resolve Studio's display label for an insert-catalog category, falling back to the raw category id.
 * @todo Move insert-catalog presentation metadata out of `src/index.ts` into the insert domain.
 */
export function getInsertCatalogCategoryLabel(category: string): string {
  return Object.entries(CATEGORY_LABELS).find(([key]) => key === category)?.[1] ?? category;
}

/*** Resolve a category's preferred sort position and place unknown categories after the configured list. */
function resolveCategoryOrder(category: string): number {
  const index = CATEGORY_ORDER.indexOf(category as (typeof CATEGORY_ORDER)[number]);
  return index === -1 ? CATEGORY_ORDER.length : index;
}

/*** Convert an insert-recipe validation issue to the Studio-facing disabled reason text. */
function describeInsertRecipeIssue(issue: InsertRecipeIssue): string {
  if (issue.code === 'missing-meta') {
    return `Missing component metadata for ${issue.nodeType}.`;
  }

  return `Child ${issue.childType ?? 'unknown'} is not allowed under ${issue.nodeType}.`;
}

/***
 * Validate an insert recipe recursively against Studio component metadata and allowed-child constraints.
 * @todo Move recipe validation from `src/index.ts` into the insert/templates domain.
 */
export function validateInsertRecipe(
  recipe: InsertRecipe,
  componentMeta: StudioComponentMetaRegistry,
): InsertRecipeIssue | null {
  /*** Visit one recipe node, validating metadata and child compatibility while retaining the recipe path. */
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

/***
 * Materialize a Studio insert-recipe tree into UiNodes using component blueprint defaults and an injected id generator.
 * @todo Move recipe-node creation from `src/index.ts` into the insert/templates domain.
 */
function createNodeFromRecipe(
  recipe: InsertRecipe,
  componentMeta: StudioComponentMetaRegistry,
  createId: StudioIdGenerator,
): UiNode {
  /*** Build one recipe node and recursively materialize its children. */
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

/***
 * Materialize one enabled component or recipe catalog entry into a fresh UiNode tree.
 * @todo Move insert-catalog node creation from `src/index.ts` into the insert domain.
 */
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

/*** Project one Studio component metadata entry into its insert-catalog entry and direct-node availability state. */
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

/*** Project one Studio recipe into an enabled/disabled insert-catalog entry after recipe validation. */
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

/***
 * Build and deterministically sort Studio's component/recipe insert catalog from component metadata and recipes.
 * @todo Move insert-catalog construction from `src/index.ts` into the insert domain.
 */
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

  /*** Order catalog entries by configured category rank and then locale-aware label order. */
  return [...componentEntries, ...recipeEntries].sort((left, right) => {
    const leftOrder = resolveCategoryOrder(left.category);
    const rightOrder = resolveCategoryOrder(right.category);
    if (leftOrder !== rightOrder) {
      return leftOrder - rightOrder;
    }

    return left.label.localeCompare(right.label);
  });
}

/*** Resolve the default validated placement for one insert-catalog entry. */
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

/***
 * Resolve enabled/disabled insert-catalog state against the active screen and selected-node placement context.
 * @todo Move context-sensitive insert catalog projection from `src/index.ts` into the insert/canvas application domain.
 */
export function resolveInsertCatalogEntries(args: {
  entries: readonly InsertCatalogEntry[];
  root: UiNode | null;
  selectedNodeId: string | null;
  componentMeta: StudioComponentMetaRegistry;
}): InsertCatalogEntry[] {
  const { entries, root, selectedNodeId, componentMeta } = args;

  /*** Project one entry to its current placement availability while preserving already-disabled catalog entries. */
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

/***
 * Return whether a value is a non-array record whose values are all strings or numbers.
 * @utility @ankhorage/utility/object
 */
function isStyleRecord(value: unknown): value is Record<string, string | number> {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) return false;

  return Object.values(value).every(
    (entry) => typeof entry === 'string' || typeof entry === 'number',
  );
}
