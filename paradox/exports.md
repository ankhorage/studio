# Public API

## ACTION_REGISTRY

Kind: `value`
Module: `src/index.ts`
Source: `src/index.ts:305:14`

## ActionDefinition

Kind: `type`
Module: `src/index.ts`
Source: `src/index.ts:219:1`

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
Source: `src/index.ts:527:14`

### Signatures

- `(args: { root: UiNode; targetId: string; newNode: UiNode; componentMeta: StudioComponentMetaRegistry; mode?: "append" | "prepend"; }) => UiNode`
  - args: `{ root: UiNode; targetId: string; newNode: UiNode; componentMeta: StudioComponentMetaRegistry; mode?: "append" | "prepend"; }`
  - returns: `UiNode`

## buildInsertCatalogEntries

Kind: `function`
Module: `src/index.ts`
Source: `src/index.ts:1239:1`

### Signatures

- `(args: { componentMeta: StudioComponentMetaRegistry; recipes?: readonly InsertRecipe[]; }) => InsertCatalogEntry[]`
  - args: `{ componentMeta: StudioComponentMetaRegistry; recipes?: readonly InsertRecipe[]; }`
  - returns: `InsertCatalogEntry[]`

## canAcceptChild

Kind: `function`
Module: `src/index.ts`
Source: `src/index.ts:686:1`

### Signatures

- `(args: { parentType: string; childType: string; componentMeta: StudioComponentMetaRegistry; }) => boolean`
  - args: `{ parentType: string; childType: string; componentMeta: StudioComponentMetaRegistry; }`
  - returns: `boolean`

## cloneWithNewIds

Kind: `value`
Module: `src/index.ts`
Source: `src/index.ts:452:14`

### Signatures

- `(node: UiNode, createId?: StudioIdGenerator) => UiNode`
  - createId: `StudioIdGenerator` (optional)
  - node: `UiNode`
  - returns: `UiNode`

## createNodeFromCatalogEntry

Kind: `function`
Module: `src/index.ts`
Source: `src/index.ts:1158:1`

### Signatures

- `(entry: InsertCatalogEntry, componentMeta: StudioComponentMetaRegistry, createId?: StudioIdGenerator) => UiNode`
  - componentMeta: `StudioComponentMetaRegistry`
  - createId: `StudioIdGenerator` (optional)
  - entry: `InsertCatalogEntry`
  - returns: `UiNode`

## findNodeById

Kind: `value`
Module: `src/index.ts`
Source: `src/index.ts:469:14`

### Signatures

- `(root: UiNode, id: string) => UiNode | null`
  - id: `string`
  - root: `UiNode`
  - returns: `UiNode | null`

## generateStudioId

Kind: `value`
Module: `src/index.ts`
Source: `src/index.ts:445:14`

### Signatures

- `(prefix?: string | undefined) => string`
  - prefix: `string | undefined` (optional)
  - returns: `string`

## getInsertCatalogCategoryLabel

Kind: `function`
Module: `src/index.ts`
Source: `src/index.ts:1084:1`

### Signatures

- `(category: string) => string`
  - category: `string`
  - returns: `string`

## InsertCatalogComponentEntry

Kind: `type`
Module: `src/index.ts`
Source: `src/index.ts:197:1`

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
Source: `src/index.ts:179:1`

### Members

| Name   | Kind     | Type                              | Required | Description |
| ------ | -------- | --------------------------------- | -------- | ----------- |
| code   | property | `InsertCatalogDisabledReasonCode` | yes      |             |
| detail | property | `string`                          | yes      |             |
| issue  | property | `InsertRecipeIssue \| undefined`  | no       |             |

## InsertCatalogDisabledReasonCode

Kind: `unknown`
Module: `src/index.ts`
Source: `src/index.ts:156:1`

## InsertCatalogEntry

Kind: `unknown`
Module: `src/index.ts`
Source: `src/index.ts:207:1`

## InsertCatalogEntryBase

Kind: `type`
Module: `src/index.ts`
Source: `src/index.ts:185:1`

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
Source: `src/index.ts:153:1`

## InsertCatalogEntryStatus

Kind: `unknown`
Module: `src/index.ts`
Source: `src/index.ts:154:1`

## InsertCatalogRecipeEntry

Kind: `type`
Module: `src/index.ts`
Source: `src/index.ts:202:1`

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
Source: `src/index.ts:916:1`

### Signatures

- `(args: InsertNodeAtPlacementArgs) => InsertNodeAtPlacementResult | null`
  - args: `InsertNodeAtPlacementArgs`
  - returns: `InsertNodeAtPlacementResult | null`

## InsertNodeAtPlacementArgs

Kind: `type`
Module: `src/index.ts`
Source: `src/index.ts:859:1`

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
Source: `src/index.ts:866:1`

### Members

| Name           | Kind     | Type     | Required | Description |
| -------------- | -------- | -------- | -------- | ----------- |
| insertedNodeId | property | `string` | yes      |             |
| root           | property | `UiNode` | yes      |             |

## InsertRecipe

Kind: `type`
Module: `src/index.ts`
Source: `src/index.ts:164:1`

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
Source: `src/index.ts:172:1`

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
Source: `src/index.ts:159:1`

### Members

| Name     | Kind     | Type                              | Required | Description |
| -------- | -------- | --------------------------------- | -------- | ----------- |
| children | property | `InsertRecipeNode[] \| undefined` | no       |             |
| type     | property | `string`                          | yes      |             |

## ModuleDefinition

Kind: `type`
Module: `src/index.ts`
Source: `src/index.ts:227:1`

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
Source: `src/index.ts:560:14`

### Signatures

- `(root: UiNode, nodeId: string, direction: "up" | "down") => UiNode`
  - direction: `"up" | "down"`
  - nodeId: `string`
  - root: `UiNode`
  - returns: `UiNode`

## moveNodeToPlacement

Kind: `function`
Module: `src/index.ts`
Source: `src/index.ts:984:1`

### Signatures

- `(args: MoveNodeToPlacementArgs) => MoveNodeToPlacementResult | null`
  - args: `MoveNodeToPlacementArgs`
  - returns: `MoveNodeToPlacementResult | null`

## MoveNodeToPlacementArgs

Kind: `type`
Module: `src/index.ts`
Source: `src/index.ts:943:1`

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
Source: `src/index.ts:950:1`

### Members

| Name        | Kind     | Type     | Required | Description |
| ----------- | -------- | -------- | -------- | ----------- |
| movedNodeId | property | `string` | yes      |             |
| root        | property | `UiNode` | yes      |             |

## NodePlacement

Kind: `type`
Module: `src/index.ts`
Source: `src/index.ts:115:1`

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
Source: `src/index.ts:122:1`

## PlacementFailureReason

Kind: `type`
Module: `src/index.ts`
Source: `src/index.ts:134:1`

### Members

| Name    | Kind     | Type                   | Required | Description |
| ------- | -------- | ---------------------- | -------- | ----------- |
| code    | property | `PlacementFailureCode` | yes      |             |
| message | property | `string`               | yes      |             |

## PlacementKind

Kind: `unknown`
Module: `src/index.ts`
Source: `src/index.ts:113:1`

## PlacementResolutionResult

Kind: `unknown`
Module: `src/index.ts`
Source: `src/index.ts:146:1`

## PlacementValidationResult

Kind: `unknown`
Module: `src/index.ts`
Source: `src/index.ts:139:1`

## removeNodeFromTree

Kind: `value`
Module: `src/index.ts`
Source: `src/index.ts:509:14`

### Signatures

- `(root: UiNode, nodeId: string) => UiNode | null`
  - nodeId: `string`
  - root: `UiNode`
  - returns: `UiNode | null`

## resolveDefaultInsertPlacement

Kind: `function`
Module: `src/index.ts`
Source: `src/index.ts:814:1`

### Signatures

- `(args: { root: UiNode; selectedNodeId: string | null; childType: string; componentMeta: StudioComponentMetaRegistry; }) => PlacementResolutionResult`
  - args: `{ root: UiNode; selectedNodeId: string | null; childType: string; componentMeta: StudioComponentMetaRegistry; }`
  - returns: `PlacementResolutionResult`

## resolveInsertCatalogEntries

Kind: `function`
Module: `src/index.ts`
Source: `src/index.ts:1281:1`

### Signatures

- `(args: { entries: readonly InsertCatalogEntry[]; root: UiNode | null; selectedNodeId: string | null; componentMeta: StudioComponentMetaRegistry; }) => InsertCatalogEntry[]`
  - args: `{ entries: readonly InsertCatalogEntry[]; root: UiNode | null; selectedNodeId: string | null; componentMeta: StudioComponentMetaRegistry; }`
  - returns: `InsertCatalogEntry[]`

## resolveInsertPlacement

Kind: `function`
Module: `src/index.ts`
Source: `src/index.ts:753:1`

### Signatures

- `(args: { root: UiNode; targetNodeId: string; childType: string; componentMeta: StudioComponentMetaRegistry; kind: PlacementKind; }) => PlacementResolutionResult`
  - args: `{ root: UiNode; targetNodeId: string; childType: string; componentMeta: StudioComponentMetaRegistry; kind: PlacementKind; }`
  - returns: `PlacementResolutionResult`

## STUDIO_INSERT_RECIPES

Kind: `value`
Module: `src/index.ts`
Source: `src/index.ts:1051:14`

| id             | label          | description                              | category |
| -------------- | -------------- | ---------------------------------------- | -------- |
| screen-section | Screen section | A screen section with a starter heading. | recipe   |
| panel-stack    | Panel stack    | Panel with a stack starter.              | recipe   |
| card-heading   | Card heading   | Card with a headline.                    | recipe   |

## STUDIO_PACKAGE_BOUNDARY

Kind: `value`
Module: `src/index.ts`
Source: `src/index.ts:24:14`

## STUDIO_PACKAGE_NAME

Kind: `value`
Module: `src/index.ts`
Source: `src/index.ts:16:14`

## STUDIO_PUBLIC_CONTRACTS

Kind: `value`
Module: `src/index.ts`
Source: `src/index.ts:52:14`

## StudioActionPayloadField

Kind: `type`
Module: `src/index.ts`
Source: `src/index.ts:211:1`

### Members

| Name     | Kind     | Type                           | Required | Description |
| -------- | -------- | ------------------------------ | -------- | ----------- |
| label    | property | `string`                       | yes      |             |
| required | property | `boolean \| undefined`         | no       |             |
| type     | property | `StudioActionPayloadPrimitive` | yes      |             |

## StudioActionPayloadPrimitive

Kind: `unknown`
Module: `src/index.ts`
Source: `src/index.ts:209:1`

## StudioActionPayloadSchema

Kind: `unknown`
Module: `src/index.ts`
Source: `src/index.ts:217:1`

## StudioAdminRoutePath

Kind: `unknown`
Module: `src/index.ts`
Source: `src/index.ts:80:1`

## StudioApp

Kind: `function`
Module: `src/app/StudioApp.tsx`
Source: `src/app/StudioApp.tsx:10:1`

### Signatures

- `() => React.JSX.Element`
  - returns: `React.JSX.Element`

## StudioCommand

Kind: `unknown`
Module: `src/index.ts`
Source: `src/index.ts:252:1`

## StudioComponentBlueprint

Kind: `type`
Module: `src/index.ts`
Source: `src/index.ts:236:1`

### Members

| Name         | Kind     | Type                                   | Required | Description |
| ------------ | -------- | -------------------------------------- | -------- | ----------- |
| defaultProps | property | `Record<string, unknown> \| undefined` | no       |             |
| label        | property | `string \| undefined`                  | no       |             |

## StudioComponentMeta

Kind: `type`
Module: `src/index.ts`
Source: `src/index.ts:241:1`

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
Source: `src/index.ts:248:1`

## StudioContextValue

Kind: `type`
Module: `src/index.ts`
Source: `src/index.ts:268:1`

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

## StudioDashboard

Kind: `function`
Module: `src/app/StudioDashboard.tsx`
Source: `src/app/StudioDashboard.tsx:26:1`

### Signatures

- `() => React.JSX.Element`
  - returns: `React.JSX.Element`

## StudioEvent

Kind: `unknown`
Module: `src/index.ts`
Source: `src/index.ts:261:1`

## StudioIdGenerator

Kind: `unknown`
Module: `src/index.ts`
Source: `src/index.ts:250:1`

## StudioLocale

Kind: `unknown`
Module: `src/index.ts`
Source: `src/index.ts:75:1`

## StudioManifest

Kind: `unknown`
Module: `src/index.ts`
Source: `src/index.ts:83:1`

## StudioMode

Kind: `unknown`
Module: `src/index.ts`
Source: `src/index.ts:77:1`

## StudioModuleId

Kind: `unknown`
Module: `src/index.ts`
Source: `src/index.ts:74:1`

## StudioNodeId

Kind: `unknown`
Module: `src/index.ts`
Source: `src/index.ts:72:1`

## StudioPackageBoundary

Kind: `type`
Module: `src/index.ts`
Source: `src/index.ts:18:1`

### Members

| Name       | Kind     | Type                | Required | Description |
| ---------- | -------- | ------------------- | -------- | ----------- |
| consumes   | property | `readonly string[]` | yes      |             |
| doesNotOwn | property | `readonly string[]` | yes      |             |
| owns       | property | `readonly string[]` | yes      |             |

## StudioPanelId

Kind: `unknown`
Module: `src/index.ts`
Source: `src/index.ts:79:1`

## StudioProjectId

Kind: `unknown`
Module: `src/index.ts`
Source: `src/index.ts:70:1`

## StudioPublicContract

Kind: `unknown`
Module: `src/index.ts`
Source: `src/index.ts:68:1`

## StudioSaveStatus

Kind: `unknown`
Module: `src/index.ts`
Source: `src/index.ts:78:1`

## StudioScreenId

Kind: `unknown`
Module: `src/index.ts`
Source: `src/index.ts:73:1`

## StudioSelectionState

Kind: `type`
Module: `src/index.ts`
Source: `src/index.ts:94:1`

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
Source: `src/index.ts:71:1`

## StudioSessionState

Kind: `type`
Module: `src/index.ts`
Source: `src/index.ts:102:1`

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
Source: `src/index.ts:89:1`

## TPL_SCREEN_EMPTY

Kind: `value`
Module: `src/index.ts`
Source: `src/index.ts:397:14`

## updateNodeInTree

Kind: `value`
Module: `src/index.ts`
Source: `src/index.ts:481:14`

### Signatures

- `(root: UiNode, id: string, newProps: Record<string, unknown>) => UiNode`
  - id: `string`
  - newProps: `Record<string, unknown>`
  - root: `UiNode`
  - returns: `UiNode`

## validateInsertRecipe

Kind: `function`
Module: `src/index.ts`
Source: `src/index.ts:1101:1`

### Signatures

- `(recipe: InsertRecipe, componentMeta: StudioComponentMetaRegistry) => InsertRecipeIssue | null`
  - componentMeta: `StudioComponentMetaRegistry`
  - recipe: `InsertRecipe`
  - returns: `InsertRecipeIssue | null`

## validateNodePlacement

Kind: `function`
Module: `src/index.ts`
Source: `src/index.ts:698:1`

### Signatures

- `(args: { root: UiNode; placement: NodePlacement; childType: string; componentMeta: StudioComponentMetaRegistry; }) => PlacementValidationResult`
  - args: `{ root: UiNode; placement: NodePlacement; childType: string; componentMeta: StudioComponentMetaRegistry; }`
  - returns: `PlacementValidationResult`
