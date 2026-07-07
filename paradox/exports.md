# Public API

## ACTION_REGISTRY

Kind: `value`
Module: `src/index.ts`
Source: `src/index.ts:304:14`

## ActionDefinition

Kind: `type`
Module: `src/index.ts`
Source: `src/index.ts:218:1`

### Members

| Name            | Kind     | Type                                     | Required | Description |
| --------------- | -------- | ---------------------------------------- | -------- | ----------- |
| description     | property | `string`                                 | yes      |             |
| label           | property | `string`                                 | yes      |             |
| payloadSchema   | property | `StudioActionPayloadSchema \| undefined` | no       |             |
| requiresPayload | property | `boolean`                                | yes      |             |
| type            | property | `ActionType`                             | yes      |             |

## addNodeToTree

Kind: `value`
Module: `src/index.ts`
Source: `src/index.ts:526:14`

### Signatures

- `(args: { root: UiNode; targetId: string; newNode: UiNode; componentMeta: StudioComponentMetaRegistry; mode?: "append" | "prepend"; }) => UiNode`
  - args: `{ root: UiNode; targetId: string; newNode: UiNode; componentMeta: StudioComponentMetaRegistry; mode?: "append" | "prepend"; }`
  - returns: `UiNode`

## buildInsertCatalogEntries

Kind: `function`
Module: `src/index.ts`
Source: `src/index.ts:1238:1`

### Signatures

- `(args: { componentMeta: StudioComponentMetaRegistry; recipes?: readonly InsertRecipe[]; }) => InsertCatalogEntry[]`
  - args: `{ componentMeta: StudioComponentMetaRegistry; recipes?: readonly InsertRecipe[]; }`
  - returns: `InsertCatalogEntry[]`

## canAcceptChild

Kind: `function`
Module: `src/index.ts`
Source: `src/index.ts:685:1`

### Signatures

- `(args: { parentType: string; childType: string; componentMeta: StudioComponentMetaRegistry; }) => boolean`
  - args: `{ parentType: string; childType: string; componentMeta: StudioComponentMetaRegistry; }`
  - returns: `boolean`

## cloneWithNewIds

Kind: `value`
Module: `src/index.ts`
Source: `src/index.ts:451:14`

### Signatures

- `(node: UiNode, createId?: StudioIdGenerator) => UiNode`
  - createId: `StudioIdGenerator` (optional)
  - node: `UiNode`
  - returns: `UiNode`

## createNodeFromCatalogEntry

Kind: `function`
Module: `src/index.ts`
Source: `src/index.ts:1157:1`

### Signatures

- `(entry: InsertCatalogEntry, componentMeta: StudioComponentMetaRegistry, createId?: StudioIdGenerator) => UiNode`
  - componentMeta: `StudioComponentMetaRegistry`
  - createId: `StudioIdGenerator` (optional)
  - entry: `InsertCatalogEntry`
  - returns: `UiNode`

## findNodeById

Kind: `value`
Module: `src/index.ts`
Source: `src/index.ts:468:14`

### Signatures

- `(root: UiNode, id: string) => UiNode | null`
  - id: `string`
  - root: `UiNode`
  - returns: `UiNode | null`

## generateStudioId

Kind: `value`
Module: `src/index.ts`
Source: `src/index.ts:444:14`

### Signatures

- `(prefix?: string | undefined) => string`
  - prefix: `string | undefined` (optional)
  - returns: `string`

## getInsertCatalogCategoryLabel

Kind: `function`
Module: `src/index.ts`
Source: `src/index.ts:1083:1`

### Signatures

- `(category: string) => string`
  - category: `string`
  - returns: `string`

## InsertCatalogComponentEntry

Kind: `type`
Module: `src/index.ts`
Source: `src/index.ts:196:1`

### Members

| Name           | Kind     | Type                                       | Required | Description |
| -------------- | -------- | ------------------------------------------ | -------- | ----------- |
| category       | property | `string`                                   | yes      |             |
| componentType  | property | `string`                                   | yes      |             |
| description    | property | `string \| undefined`                      | no       |             |
| disabledReason | property | `InsertCatalogDisabledReason \| undefined` | no       |             |
| id             | property | `string`                                   | yes      |             |
| kind           | property | `"component"`                              | yes      |             |
| label          | property | `string`                                   | yes      |             |
| placement      | property | `NodePlacement \| undefined`               | no       |             |
| rootType       | property | `string`                                   | yes      |             |
| status         | property | `InsertCatalogEntryStatus`                 | yes      |             |

## InsertCatalogDisabledReason

Kind: `type`
Module: `src/index.ts`
Source: `src/index.ts:178:1`

### Members

| Name   | Kind     | Type                              | Required | Description |
| ------ | -------- | --------------------------------- | -------- | ----------- |
| code   | property | `InsertCatalogDisabledReasonCode` | yes      |             |
| detail | property | `string`                          | yes      |             |
| issue  | property | `InsertRecipeIssue \| undefined`  | no       |             |

## InsertCatalogDisabledReasonCode

Kind: `unknown`
Module: `src/index.ts`
Source: `src/index.ts:155:1`

## InsertCatalogEntry

Kind: `unknown`
Module: `src/index.ts`
Source: `src/index.ts:206:1`

## InsertCatalogEntryBase

Kind: `type`
Module: `src/index.ts`
Source: `src/index.ts:184:1`

### Members

| Name           | Kind     | Type                                       | Required | Description |
| -------------- | -------- | ------------------------------------------ | -------- | ----------- |
| category       | property | `string`                                   | yes      |             |
| description    | property | `string \| undefined`                      | no       |             |
| disabledReason | property | `InsertCatalogDisabledReason \| undefined` | no       |             |
| id             | property | `string`                                   | yes      |             |
| kind           | property | `InsertCatalogEntryKind`                   | yes      |             |
| label          | property | `string`                                   | yes      |             |
| placement      | property | `NodePlacement \| undefined`               | no       |             |
| rootType       | property | `string`                                   | yes      |             |
| status         | property | `InsertCatalogEntryStatus`                 | yes      |             |

## InsertCatalogEntryKind

Kind: `unknown`
Module: `src/index.ts`
Source: `src/index.ts:152:1`

## InsertCatalogEntryStatus

Kind: `unknown`
Module: `src/index.ts`
Source: `src/index.ts:153:1`

## InsertCatalogRecipeEntry

Kind: `type`
Module: `src/index.ts`
Source: `src/index.ts:201:1`

### Members

| Name           | Kind     | Type                                       | Required | Description |
| -------------- | -------- | ------------------------------------------ | -------- | ----------- |
| category       | property | `string`                                   | yes      |             |
| description    | property | `string \| undefined`                      | no       |             |
| disabledReason | property | `InsertCatalogDisabledReason \| undefined` | no       |             |
| id             | property | `string`                                   | yes      |             |
| kind           | property | `"recipe"`                                 | yes      |             |
| label          | property | `string`                                   | yes      |             |
| placement      | property | `NodePlacement \| undefined`               | no       |             |
| recipe         | property | `InsertRecipe`                             | yes      |             |
| rootType       | property | `string`                                   | yes      |             |
| status         | property | `InsertCatalogEntryStatus`                 | yes      |             |

## insertNodeAtPlacement

Kind: `function`
Module: `src/index.ts`
Source: `src/index.ts:915:1`

### Signatures

- `(args: InsertNodeAtPlacementArgs) => InsertNodeAtPlacementResult | null`
  - args: `InsertNodeAtPlacementArgs`
  - returns: `InsertNodeAtPlacementResult | null`

## InsertNodeAtPlacementArgs

Kind: `type`
Module: `src/index.ts`
Source: `src/index.ts:858:1`

### Members

| Name          | Kind     | Type                          | Required | Description |
| ------------- | -------- | ----------------------------- | -------- | ----------- |
| componentMeta | property | `StudioComponentMetaRegistry` | yes      |             |
| makeNode      | property | `() => UiNode`                | yes      |             |
| placement     | property | `NodePlacement`               | yes      |             |
| root          | property | `UiNode`                      | yes      |             |

## InsertNodeAtPlacementResult

Kind: `type`
Module: `src/index.ts`
Source: `src/index.ts:865:1`

### Members

| Name           | Kind     | Type     | Required | Description |
| -------------- | -------- | -------- | -------- | ----------- |
| insertedNodeId | property | `string` | yes      |             |
| root           | property | `UiNode` | yes      |             |

## InsertRecipe

Kind: `type`
Module: `src/index.ts`
Source: `src/index.ts:163:1`

### Members

| Name        | Kind     | Type                  | Required | Description |
| ----------- | -------- | --------------------- | -------- | ----------- |
| category    | property | `string`              | yes      |             |
| description | property | `string \| undefined` | no       |             |
| id          | property | `string`              | yes      |             |
| label       | property | `string`              | yes      |             |
| root        | property | `InsertRecipeNode`    | yes      |             |

## InsertRecipeIssue

Kind: `type`
Module: `src/index.ts`
Source: `src/index.ts:171:1`

### Members

| Name      | Kind     | Type                                    | Required | Description |
| --------- | -------- | --------------------------------------- | -------- | ----------- |
| childType | property | `string \| undefined`                   | no       |             |
| code      | property | `"child-not-allowed" \| "missing-meta"` | yes      |             |
| nodeType  | property | `string`                                | yes      |             |
| path      | property | `string[]`                              | yes      |             |

## InsertRecipeNode

Kind: `type`
Module: `src/index.ts`
Source: `src/index.ts:158:1`

### Members

| Name     | Kind     | Type                              | Required | Description |
| -------- | -------- | --------------------------------- | -------- | ----------- |
| children | property | `InsertRecipeNode[] \| undefined` | no       |             |
| type     | property | `string`                          | yes      |             |

## ModuleDefinition

Kind: `type`
Module: `src/index.ts`
Source: `src/index.ts:226:1`

### Members

| Name        | Kind     | Type                                           | Required | Description |
| ----------- | -------- | ---------------------------------------------- | -------- | ----------- |
| description | property | `string`                                       | yes      |             |
| id          | property | `string`                                       | yes      |             |
| name        | property | `string`                                       | yes      |             |
| ui          | property | `{ modal?: { title: string; }; } \| undefined` | no       |             |

## moveNodeInTree

Kind: `value`
Module: `src/index.ts`
Source: `src/index.ts:559:14`

### Signatures

- `(root: UiNode, nodeId: string, direction: "up" | "down") => UiNode`
  - direction: `"up" | "down"`
  - nodeId: `string`
  - root: `UiNode`
  - returns: `UiNode`

## moveNodeToPlacement

Kind: `function`
Module: `src/index.ts`
Source: `src/index.ts:983:1`

### Signatures

- `(args: MoveNodeToPlacementArgs) => MoveNodeToPlacementResult | null`
  - args: `MoveNodeToPlacementArgs`
  - returns: `MoveNodeToPlacementResult | null`

## MoveNodeToPlacementArgs

Kind: `type`
Module: `src/index.ts`
Source: `src/index.ts:942:1`

### Members

| Name          | Kind     | Type                          | Required | Description |
| ------------- | -------- | ----------------------------- | -------- | ----------- |
| componentMeta | property | `StudioComponentMetaRegistry` | yes      |             |
| nodeId        | property | `string`                      | yes      |             |
| placement     | property | `NodePlacement`               | yes      |             |
| root          | property | `UiNode`                      | yes      |             |

## MoveNodeToPlacementResult

Kind: `type`
Module: `src/index.ts`
Source: `src/index.ts:949:1`

### Members

| Name        | Kind     | Type     | Required | Description |
| ----------- | -------- | -------- | -------- | ----------- |
| movedNodeId | property | `string` | yes      |             |
| root        | property | `UiNode` | yes      |             |

## NodePlacement

Kind: `type`
Module: `src/index.ts`
Source: `src/index.ts:114:1`

### Members

| Name        | Kind     | Type                  | Required | Description |
| ----------- | -------- | --------------------- | -------- | ----------- |
| index       | property | `number`              | yes      |             |
| kind        | property | `PlacementKind`       | yes      |             |
| parentId    | property | `string`              | yes      |             |
| referenceId | property | `string \| undefined` | no       |             |

## PlacementFailureCode

Kind: `unknown`
Module: `src/index.ts`
Source: `src/index.ts:121:1`

## PlacementFailureReason

Kind: `type`
Module: `src/index.ts`
Source: `src/index.ts:133:1`

### Members

| Name    | Kind     | Type                   | Required | Description |
| ------- | -------- | ---------------------- | -------- | ----------- |
| code    | property | `PlacementFailureCode` | yes      |             |
| message | property | `string`               | yes      |             |

## PlacementKind

Kind: `unknown`
Module: `src/index.ts`
Source: `src/index.ts:112:1`

## PlacementResolutionResult

Kind: `unknown`
Module: `src/index.ts`
Source: `src/index.ts:145:1`

## PlacementValidationResult

Kind: `unknown`
Module: `src/index.ts`
Source: `src/index.ts:138:1`

## removeNodeFromTree

Kind: `value`
Module: `src/index.ts`
Source: `src/index.ts:508:14`

### Signatures

- `(root: UiNode, nodeId: string) => UiNode | null`
  - nodeId: `string`
  - root: `UiNode`
  - returns: `UiNode | null`

## resolveDefaultInsertPlacement

Kind: `function`
Module: `src/index.ts`
Source: `src/index.ts:813:1`

### Signatures

- `(args: { root: UiNode; selectedNodeId: string | null; childType: string; componentMeta: StudioComponentMetaRegistry; }) => PlacementResolutionResult`
  - args: `{ root: UiNode; selectedNodeId: string | null; childType: string; componentMeta: StudioComponentMetaRegistry; }`
  - returns: `PlacementResolutionResult`

## resolveInsertCatalogEntries

Kind: `function`
Module: `src/index.ts`
Source: `src/index.ts:1280:1`

### Signatures

- `(args: { entries: readonly InsertCatalogEntry[]; root: UiNode | null; selectedNodeId: string | null; componentMeta: StudioComponentMetaRegistry; }) => InsertCatalogEntry[]`
  - args: `{ entries: readonly InsertCatalogEntry[]; root: UiNode | null; selectedNodeId: string | null; componentMeta: StudioComponentMetaRegistry; }`
  - returns: `InsertCatalogEntry[]`

## resolveInsertPlacement

Kind: `function`
Module: `src/index.ts`
Source: `src/index.ts:752:1`

### Signatures

- `(args: { root: UiNode; targetNodeId: string; childType: string; componentMeta: StudioComponentMetaRegistry; kind: PlacementKind; }) => PlacementResolutionResult`
  - args: `{ root: UiNode; targetNodeId: string; childType: string; componentMeta: StudioComponentMetaRegistry; kind: PlacementKind; }`
  - returns: `PlacementResolutionResult`

## STUDIO_INSERT_RECIPES

Kind: `value`
Module: `src/index.ts`
Source: `src/index.ts:1050:14`

| id             | label          | description                              | category |
| -------------- | -------------- | ---------------------------------------- | -------- |
| screen-section | Screen section | A screen section with a starter heading. | recipe   |
| panel-stack    | Panel stack    | Panel with a stack starter.              | recipe   |
| card-heading   | Card heading   | Card with a headline.                    | recipe   |

## STUDIO_PACKAGE_BOUNDARY

Kind: `value`
Module: `src/index.ts`
Source: `src/index.ts:23:14`

## STUDIO_PACKAGE_NAME

Kind: `value`
Module: `src/index.ts`
Source: `src/index.ts:15:14`

## STUDIO_PUBLIC_CONTRACTS

Kind: `value`
Module: `src/index.ts`
Source: `src/index.ts:51:14`

## StudioActionPayloadField

Kind: `type`
Module: `src/index.ts`
Source: `src/index.ts:210:1`

### Members

| Name     | Kind     | Type                           | Required | Description |
| -------- | -------- | ------------------------------ | -------- | ----------- |
| label    | property | `string`                       | yes      |             |
| required | property | `boolean \| undefined`         | no       |             |
| type     | property | `StudioActionPayloadPrimitive` | yes      |             |

## StudioActionPayloadPrimitive

Kind: `unknown`
Module: `src/index.ts`
Source: `src/index.ts:208:1`

## StudioActionPayloadSchema

Kind: `unknown`
Module: `src/index.ts`
Source: `src/index.ts:216:1`

## StudioAdminRoutePath

Kind: `unknown`
Module: `src/index.ts`
Source: `src/index.ts:79:1`

## StudioCommand

Kind: `unknown`
Module: `src/index.ts`
Source: `src/index.ts:251:1`

## StudioComponentBlueprint

Kind: `type`
Module: `src/index.ts`
Source: `src/index.ts:235:1`

### Members

| Name         | Kind     | Type                                   | Required | Description |
| ------------ | -------- | -------------------------------------- | -------- | ----------- |
| defaultProps | property | `Record<string, unknown> \| undefined` | no       |             |
| label        | property | `string \| undefined`                  | no       |             |

## StudioComponentMeta

Kind: `type`
Module: `src/index.ts`
Source: `src/index.ts:240:1`

### Members

| Name               | Kind     | Type                                    | Required | Description |
| ------------------ | -------- | --------------------------------------- | -------- | ----------- |
| allowedChildren    | property | `readonly string[]`                     | yes      |             |
| blueprint          | property | `StudioComponentBlueprint \| undefined` | no       |             |
| category           | property | `string`                                | yes      |             |
| directManifestNode | property | `boolean \| undefined`                  | no       |             |

## StudioComponentMetaRegistry

Kind: `unknown`
Module: `src/index.ts`
Source: `src/index.ts:247:1`

## StudioContextValue

Kind: `type`
Module: `src/index.ts`
Source: `src/index.ts:267:1`

### Members

| Name                      | Kind     | Type                                                                  | Required | Description |
| ------------------------- | -------- | --------------------------------------------------------------------- | -------- | ----------- |
| activeAdminRoutePath      | property | `StudioAdminRoutePath`                                                | yes      |             |
| activeCanvasDragNodeId    | property | `string \| null`                                                      | yes      |             |
| activeLocale              | property | `string`                                                              | yes      |             |
| activePanelId             | property | `StudioPanelId \| null`                                               | yes      |             |
| activeScreenId            | property | `string \| null`                                                      | yes      |             |
| addScreen                 | property | `(name: string) => void`                                              | yes      |             |
| addTheme                  | property | `() => void`                                                          | yes      |             |
| deleteNode                | property | `(id: StudioNodeId) => void`                                          | yes      |             |
| deleteScreen              | property | `(id: StudioScreenId) => void`                                        | yes      |             |
| deleteTheme               | property | `(id: string) => void`                                                | yes      |             |
| error                     | property | `string \| null`                                                      | yes      |             |
| findNode                  | property | `(root: UiNode, id: StudioNodeId) => UiNode \| null`                  | yes      |             |
| insertFromCatalogEntry    | property | `(entry: InsertCatalogEntry) => boolean`                              | yes      |             |
| isLoading                 | property | `boolean`                                                             | yes      |             |
| manifest                  | property | `StudioManifest \| null`                                              | yes      |             |
| moveNode                  | property | `(id: StudioNodeId, direction: "up" \| "down") => void`               | yes      |             |
| moveNodeToPlacement       | property | `(nodeId: StudioNodeId, placement: NodePlacement) => boolean`         | yes      |             |
| previewMode               | property | `boolean`                                                             | yes      |             |
| projectId                 | property | `string`                                                              | yes      |             |
| refetchManifest           | property | `() => Promise<void>`                                                 | yes      |             |
| reloadDictionaries        | property | `() => Promise<void>`                                                 | yes      |             |
| reorderScreens            | property | `(newRoutes: RouteDefinition[]) => void`                              | yes      |             |
| rootNode                  | property | `UiNode \| null`                                                      | yes      |             |
| saveStatus                | property | `StudioSaveStatus`                                                    | yes      |             |
| selectedNodeId            | property | `string \| null`                                                      | yes      |             |
| selectNode                | property | `(id: StudioNodeId \| null) => void`                                  | yes      |             |
| sessionId                 | property | `string \| undefined`                                                 | no       |             |
| setActiveAdminRoutePath   | property | `(routePath: StudioAdminRoutePath) => void`                           | yes      |             |
| setActiveCanvasDragNodeId | property | `(nodeId: StudioNodeId \| null) => void`                              | yes      |             |
| setActiveLocale           | property | `(locale: StudioLocale) => void`                                      | yes      |             |
| setActivePanelId          | property | `(panelId: StudioPanelId \| null) => void`                            | yes      |             |
| setActiveScreenId         | property | `(id: StudioScreenId) => void`                                        | yes      |             |
| setActiveThemeId          | property | `(id: string) => void`                                                | yes      |             |
| setActiveThemeMode        | property | `(mode: StudioMode) => void`                                          | yes      |             |
| setNavigatorInitialRoute  | property | `(routeName: string) => void`                                         | yes      |             |
| setNavigatorType          | property | `(type: NavigatorType) => void`                                       | yes      |             |
| setStudioMode             | property | `(mode: StudioMode) => void`                                          | yes      |             |
| studioMode                | property | `StudioMode`                                                          | yes      |             |
| t                         | property | `(key: string) => string`                                             | yes      |             |
| togglePreviewMode         | property | `() => void`                                                          | yes      |             |
| updateAppData             | property | `(data: AppDataManifest) => void`                                     | yes      |             |
| updateDataBindings        | property | `(dataBindings: ComponentDataBindingRegistry) => void`                | yes      |             |
| updateDataSources         | property | `(dataSources: DataSourceRegistry) => void`                           | yes      |             |
| updateModuleConfig        | property | `(moduleId: StudioModuleId, config: Record<string, unknown>) => void` | yes      |             |
| updateNode                | property | `(nodeId: StudioNodeId, props: Record<string, unknown>) => void`      | yes      |             |
| updateOAuthProviders      | property | `(providers: AuthOAuthProviderConfig[]) => void`                      | yes      |             |
| updateTheme               | property | `(id: string, updates: ThemeUpdates) => void`                         | yes      |             |

## StudioEvent

Kind: `unknown`
Module: `src/index.ts`
Source: `src/index.ts:260:1`

## StudioIdGenerator

Kind: `unknown`
Module: `src/index.ts`
Source: `src/index.ts:249:1`

## StudioLocale

Kind: `unknown`
Module: `src/index.ts`
Source: `src/index.ts:74:1`

## StudioManifest

Kind: `unknown`
Module: `src/index.ts`
Source: `src/index.ts:82:1`

## StudioMode

Kind: `unknown`
Module: `src/index.ts`
Source: `src/index.ts:76:1`

## StudioModuleId

Kind: `unknown`
Module: `src/index.ts`
Source: `src/index.ts:73:1`

## StudioNodeId

Kind: `unknown`
Module: `src/index.ts`
Source: `src/index.ts:71:1`

## StudioPackageBoundary

Kind: `type`
Module: `src/index.ts`
Source: `src/index.ts:17:1`

### Members

| Name       | Kind     | Type                | Required | Description |
| ---------- | -------- | ------------------- | -------- | ----------- |
| consumes   | property | `readonly string[]` | yes      |             |
| doesNotOwn | property | `readonly string[]` | yes      |             |
| owns       | property | `readonly string[]` | yes      |             |

## StudioPanelId

Kind: `unknown`
Module: `src/index.ts`
Source: `src/index.ts:78:1`

## StudioProjectId

Kind: `unknown`
Module: `src/index.ts`
Source: `src/index.ts:69:1`

## StudioPublicContract

Kind: `unknown`
Module: `src/index.ts`
Source: `src/index.ts:67:1`

## StudioSaveStatus

Kind: `unknown`
Module: `src/index.ts`
Source: `src/index.ts:77:1`

## StudioScreenId

Kind: `unknown`
Module: `src/index.ts`
Source: `src/index.ts:72:1`

## StudioSelectionState

Kind: `type`
Module: `src/index.ts`
Source: `src/index.ts:93:1`

### Members

| Name                   | Kind     | Type                    | Required | Description |
| ---------------------- | -------- | ----------------------- | -------- | ----------- |
| activeAdminRoutePath   | property | `StudioAdminRoutePath`  | yes      |             |
| activeCanvasDragNodeId | property | `string \| null`        | yes      |             |
| activePanelId          | property | `StudioPanelId \| null` | yes      |             |
| activeScreenId         | property | `string \| null`        | yes      |             |
| selectedNodeId         | property | `string \| null`        | yes      |             |

## StudioSessionId

Kind: `unknown`
Module: `src/index.ts`
Source: `src/index.ts:70:1`

## StudioSessionState

Kind: `type`
Module: `src/index.ts`
Source: `src/index.ts:101:1`

### Members

| Name         | Kind     | Type                  | Required | Description |
| ------------ | -------- | --------------------- | -------- | ----------- |
| activeLocale | property | `string`              | yes      |             |
| error        | property | `string \| null`      | yes      |             |
| isLoading    | property | `boolean`             | yes      |             |
| previewMode  | property | `boolean`             | yes      |             |
| projectId    | property | `string`              | yes      |             |
| saveStatus   | property | `StudioSaveStatus`    | yes      |             |
| sessionId    | property | `string \| undefined` | no       |             |
| studioMode   | property | `StudioMode`          | yes      |             |

## ThemeUpdates

Kind: `unknown`
Module: `src/index.ts`
Source: `src/index.ts:88:1`

## TPL_SCREEN_EMPTY

Kind: `value`
Module: `src/index.ts`
Source: `src/index.ts:396:14`

## updateNodeInTree

Kind: `value`
Module: `src/index.ts`
Source: `src/index.ts:480:14`

### Signatures

- `(root: UiNode, id: string, newProps: Record<string, unknown>) => UiNode`
  - id: `string`
  - newProps: `Record<string, unknown>`
  - root: `UiNode`
  - returns: `UiNode`

## validateInsertRecipe

Kind: `function`
Module: `src/index.ts`
Source: `src/index.ts:1100:1`

### Signatures

- `(recipe: InsertRecipe, componentMeta: StudioComponentMetaRegistry) => InsertRecipeIssue | null`
  - componentMeta: `StudioComponentMetaRegistry`
  - recipe: `InsertRecipe`
  - returns: `InsertRecipeIssue | null`

## validateNodePlacement

Kind: `function`
Module: `src/index.ts`
Source: `src/index.ts:697:1`

### Signatures

- `(args: { root: UiNode; placement: NodePlacement; childType: string; componentMeta: StudioComponentMetaRegistry; }) => PlacementValidationResult`
  - args: `{ root: UiNode; placement: NodePlacement; childType: string; componentMeta: StudioComponentMetaRegistry; }`
  - returns: `PlacementValidationResult`
