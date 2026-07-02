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
export type StudioAdminRoutePath =
  | '/'
  | '/ankh/apis'
  | '/ankh/auth'
  | '/ankh/properties'
  | '/ankh/theme';

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
  activeAdminRoutePath: StudioAdminRoutePath;
  activeCanvasDragNodeId: StudioNodeId | null;
}

export interface StudioSessionState {
  projectId: StudioProjectId;
  sessionId?: StudioSessionId;
  activeLocale: StudioLocale;
  studioMode: StudioMode;
  previewMode: boolean;
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
  | 'missing-meta'
  | 'invalid-recipe'
  | 'no-placement'
  | 'not-direct';

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

export type StudioCommand =
  | { type: 'studio.selectNode'; nodeId: StudioNodeId | null }
  | { type: 'studio.setActivePanel'; panelId: StudioPanelId | null }
  | { type: 'studio.setActiveAdminRoute'; routePath: StudioAdminRoutePath }
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
  setActiveAdminRoutePath: (routePath: StudioAdminRoutePath) => void;
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
}
