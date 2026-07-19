# Public API

## ACTION_REGISTRY

Kind: `value`
Module: `src/index.ts`
Source: `src/index.ts:349:14`

## ActionDefinition

Kind: `type`
Module: `src/index.ts`
Source: `src/index.ts:261:1`

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
Source: `src/index.ts:571:14`

### Signatures

- `(args: { root: UiNode; targetId: string; newNode: UiNode; componentMeta: StudioComponentMetaRegistry; mode?: "append" | "prepend"; }) => UiNode`
  - args: `{ root: UiNode; targetId: string; newNode: UiNode; componentMeta: StudioComponentMetaRegistry; mode?: "append" | "prepend"; }`
  - returns: `UiNode`

## buildInsertCatalogEntries

Kind: `function`
Module: `src/index.ts`
Source: `src/index.ts:1283:1`

### Signatures

- `(args: { componentMeta: StudioComponentMetaRegistry; recipes?: readonly InsertRecipe[]; }) => InsertCatalogEntry[]`
  - args: `{ componentMeta: StudioComponentMetaRegistry; recipes?: readonly InsertRecipe[]; }`
  - returns: `InsertCatalogEntry[]`

## canAcceptChild

Kind: `function`
Module: `src/index.ts`
Source: `src/index.ts:730:1`

### Signatures

- `(args: { parentType: string; childType: string; componentMeta: StudioComponentMetaRegistry; }) => boolean`
  - args: `{ parentType: string; childType: string; componentMeta: StudioComponentMetaRegistry; }`
  - returns: `boolean`

## cloneWithNewIds

Kind: `value`
Module: `src/index.ts`
Source: `src/index.ts:496:14`

### Signatures

- `(node: UiNode, createId?: StudioIdGenerator) => UiNode`
  - createId: `StudioIdGenerator` (optional)
  - node: `UiNode`
  - returns: `UiNode`

## createNodeFromCatalogEntry

Kind: `function`
Module: `src/index.ts`
Source: `src/index.ts:1202:1`

### Signatures

- `(entry: InsertCatalogEntry, componentMeta: StudioComponentMetaRegistry, createId?: StudioIdGenerator) => UiNode`
  - componentMeta: `StudioComponentMetaRegistry`
  - createId: `StudioIdGenerator` (optional)
  - entry: `InsertCatalogEntry`
  - returns: `UiNode`

## findNodeById

Kind: `value`
Module: `src/index.ts`
Source: `src/index.ts:513:14`

### Signatures

- `(root: UiNode, id: string) => UiNode | null`
  - id: `string`
  - root: `UiNode`
  - returns: `UiNode | null`

## generateStudioId

Kind: `value`
Module: `src/index.ts`
Source: `src/index.ts:489:14`

### Signatures

- `(prefix?: string | undefined) => string`
  - prefix: `string | undefined` (optional)
  - returns: `string`

## getInsertCatalogCategoryLabel

Kind: `function`
Module: `src/index.ts`
Source: `src/index.ts:1128:1`

### Signatures

- `(category: string) => string`
  - category: `string`
  - returns: `string`

## InsertCatalogComponentEntry

Kind: `type`
Module: `src/index.ts`
Source: `src/index.ts:239:1`

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
Source: `src/index.ts:221:1`

### Members

| Name   | Kind     | Type                              | Required | Description |
| ------ | -------- | --------------------------------- | -------- | ----------- |
| code   | property | `InsertCatalogDisabledReasonCode` | yes      |             |
| detail | property | `string`                          | yes      |             |
| issue  | property | `InsertRecipeIssue \| undefined`  | no       |             |

## InsertCatalogDisabledReasonCode

Kind: `unknown`
Module: `src/index.ts`
Source: `src/index.ts:198:1`

## InsertCatalogEntry

Kind: `unknown`
Module: `src/index.ts`
Source: `src/index.ts:249:1`

## InsertCatalogEntryBase

Kind: `type`
Module: `src/index.ts`
Source: `src/index.ts:227:1`

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
Source: `src/index.ts:195:1`

## InsertCatalogEntryStatus

Kind: `unknown`
Module: `src/index.ts`
Source: `src/index.ts:196:1`

## InsertCatalogRecipeEntry

Kind: `type`
Module: `src/index.ts`
Source: `src/index.ts:244:1`

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
Source: `src/index.ts:960:1`

### Signatures

- `(args: InsertNodeAtPlacementArgs) => InsertNodeAtPlacementResult | null`
  - args: `InsertNodeAtPlacementArgs`
  - returns: `InsertNodeAtPlacementResult | null`

## InsertNodeAtPlacementArgs

Kind: `type`
Module: `src/index.ts`
Source: `src/index.ts:903:1`

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
Source: `src/index.ts:910:1`

### Members

| Name           | Kind     | Type     | Required | Description |
| -------------- | -------- | -------- | -------- | ----------- |
| insertedNodeId | property | `string` | yes      |             |
| root           | property | `UiNode` | yes      |             |

## InsertRecipe

Kind: `type`
Module: `src/index.ts`
Source: `src/index.ts:206:1`

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
Source: `src/index.ts:214:1`

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
Source: `src/index.ts:201:1`

### Members

| Name     | Kind     | Type                              | Required | Description |
| -------- | -------- | --------------------------------- | -------- | ----------- |
| children | property | `InsertRecipeNode[] \| undefined` | no       |             |
| type     | property | `string`                          | yes      |             |

## ModuleDefinition

Kind: `type`
Module: `src/index.ts`
Source: `src/index.ts:269:1`

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
Source: `src/index.ts:604:14`

### Signatures

- `(root: UiNode, nodeId: string, direction: "up" | "down") => UiNode`
  - direction: `"up" | "down"`
  - nodeId: `string`
  - root: `UiNode`
  - returns: `UiNode`

## moveNodeToPlacement

Kind: `function`
Module: `src/index.ts`
Source: `src/index.ts:1028:1`

### Signatures

- `(args: MoveNodeToPlacementArgs) => MoveNodeToPlacementResult | null`
  - args: `MoveNodeToPlacementArgs`
  - returns: `MoveNodeToPlacementResult | null`

## MoveNodeToPlacementArgs

Kind: `type`
Module: `src/index.ts`
Source: `src/index.ts:987:1`

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
Source: `src/index.ts:994:1`

### Members

| Name        | Kind     | Type     | Required | Description |
| ----------- | -------- | -------- | -------- | ----------- |
| movedNodeId | property | `string` | yes      |             |
| root        | property | `UiNode` | yes      |             |

## NodePlacement

Kind: `type`
Module: `src/index.ts`
Source: `src/index.ts:157:1`

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
Source: `src/index.ts:164:1`

## PlacementFailureReason

Kind: `type`
Module: `src/index.ts`
Source: `src/index.ts:176:1`

### Members

| Name    | Kind     | Type                   | Required | Description |
| ------- | -------- | ---------------------- | -------- | ----------- |
| code    | property | `PlacementFailureCode` | yes      |             |
| message | property | `string`               | yes      |             |

## PlacementKind

Kind: `unknown`
Module: `src/index.ts`
Source: `src/index.ts:155:1`

## PlacementResolutionResult

Kind: `unknown`
Module: `src/index.ts`
Source: `src/index.ts:188:1`

## PlacementValidationResult

Kind: `unknown`
Module: `src/index.ts`
Source: `src/index.ts:181:1`

## ProjectAuthDiagnostic

Kind: `type`
Module: `src/projectAuthHealth.ts`
Source: `src/projectAuthHealth.ts:11:1`

### Members

| Name           | Kind     | Type                            | Required | Description |
| -------------- | -------- | ------------------------------- | -------- | ----------- |
| code           | property | `string`                        | yes      |             |
| credentialsRef | property | `string \| undefined`           | no       |             |
| message        | property | `string`                        | yes      |             |
| path           | property | `string \| undefined`           | no       |             |
| providerId     | property | `string \| undefined`           | no       |             |
| severity       | property | `ProjectAuthDiagnosticSeverity` | yes      |             |

## ProjectAuthDiagnosticSeverity

Kind: `unknown`
Module: `src/projectAuthHealth.ts`
Source: `src/projectAuthHealth.ts:9:1`

## ProjectAuthHealth

Kind: `type`
Module: `src/projectAuthHealth.ts`
Source: `src/projectAuthHealth.ts:34:1`

### Members

| Name         | Kind     | Type                                                                            | Required | Description |
| ------------ | -------- | ------------------------------------------------------------------------------- | -------- | ----------- |
| callbackUrls | property | `{ readonly appCallbackRoute: string; readonly providerRedirectUrl?: string; }` | yes      |             |
| diagnostics  | property | `readonly ProjectAuthDiagnostic[]`                                              | yes      |             |
| providers    | property | `readonly ProjectOAuthProviderHealth[]`                                         | yes      |             |
| status       | property | `ProjectAuthHealthStatus`                                                       | yes      |             |

## ProjectAuthHealthStatus

Kind: `unknown`
Module: `src/projectAuthHealth.ts`
Source: `src/projectAuthHealth.ts:7:1`

## ProjectOAuthProviderHealth

Kind: `type`
Module: `src/projectAuthHealth.ts`
Source: `src/projectAuthHealth.ts:23:1`

### Members

| Name             | Kind     | Type                               | Required | Description |
| ---------------- | -------- | ---------------------------------- | -------- | ----------- |
| configuredFields | property | `readonly string[]`                | yes      |             |
| credentialsRef   | property | `string \| undefined`              | no       |             |
| enabled          | property | `boolean`                          | yes      |             |
| label            | property | `string`                           | yes      |             |
| missingFields    | property | `readonly string[]`                | yes      |             |
| providerId       | property | `string`                           | yes      |             |
| requiredFields   | property | `readonly string[]`                | yes      |             |
| status           | property | `ProjectOAuthProviderHealthStatus` | yes      |             |

## ProjectOAuthProviderHealthStatus

Kind: `unknown`
Module: `src/projectAuthHealth.ts`
Source: `src/projectAuthHealth.ts:20:1`

## ProjectSecretUsage

Kind: `type`
Module: `src/projectSecretUsage.ts`
Source: `src/projectSecretUsage.ts:5:1`

### Members

| Name              | Kind     | Type                         | Required | Description |
| ----------------- | -------- | ---------------------------- | -------- | ----------- |
| breaksWhenMissing | property | `boolean`                    | yes      |             |
| category          | property | `ProjectSecretUsageCategory` | yes      |             |
| label             | property | `string`                     | yes      |             |
| ownerId           | property | `string \| undefined`        | no       |             |
| path              | property | `string`                     | yes      |             |
| ref               | property | `string`                     | yes      |             |

## ProjectSecretUsageCategory

Kind: `unknown`
Module: `src/projectSecretUsage.ts`
Source: `src/projectSecretUsage.ts:3:1`

## ProjectSecretUsageSummary

Kind: `type`
Module: `src/projectSecretUsage.ts`
Source: `src/projectSecretUsage.ts:14:1`

### Members

| Name   | Kind     | Type                            | Required | Description |
| ------ | -------- | ------------------------------- | -------- | ----------- |
| ref    | property | `string`                        | yes      |             |
| usages | property | `readonly ProjectSecretUsage[]` | yes      |             |

## removeNodeFromTree

Kind: `value`
Module: `src/index.ts`
Source: `src/index.ts:553:14`

### Signatures

- `(root: UiNode, nodeId: string) => UiNode | null`
  - nodeId: `string`
  - root: `UiNode`
  - returns: `UiNode | null`

## resolveDefaultInsertPlacement

Kind: `function`
Module: `src/index.ts`
Source: `src/index.ts:858:1`

### Signatures

- `(args: { root: UiNode; selectedNodeId: string | null; childType: string; componentMeta: StudioComponentMetaRegistry; }) => PlacementResolutionResult`
  - args: `{ root: UiNode; selectedNodeId: string | null; childType: string; componentMeta: StudioComponentMetaRegistry; }`
  - returns: `PlacementResolutionResult`

## resolveInsertCatalogEntries

Kind: `function`
Module: `src/index.ts`
Source: `src/index.ts:1325:1`

### Signatures

- `(args: { entries: readonly InsertCatalogEntry[]; root: UiNode | null; selectedNodeId: string | null; componentMeta: StudioComponentMetaRegistry; }) => InsertCatalogEntry[]`
  - args: `{ entries: readonly InsertCatalogEntry[]; root: UiNode | null; selectedNodeId: string | null; componentMeta: StudioComponentMetaRegistry; }`
  - returns: `InsertCatalogEntry[]`

## resolveInsertPlacement

Kind: `function`
Module: `src/index.ts`
Source: `src/index.ts:797:1`

### Signatures

- `(args: { root: UiNode; targetNodeId: string; childType: string; componentMeta: StudioComponentMetaRegistry; kind: PlacementKind; }) => PlacementResolutionResult`
  - args: `{ root: UiNode; targetNodeId: string; childType: string; componentMeta: StudioComponentMetaRegistry; kind: PlacementKind; }`
  - returns: `PlacementResolutionResult`

## STUDIO_INSERT_RECIPES

Kind: `value`
Module: `src/index.ts`
Source: `src/index.ts:1095:14`

| id             | label          | description                              | category |
| -------------- | -------------- | ---------------------------------------- | -------- |
| screen-section | Screen section | A screen section with a starter heading. | recipe   |
| panel-stack    | Panel stack    | Panel with a stack starter.              | recipe   |
| card-heading   | Card heading   | Card with a headline.                    | recipe   |

## STUDIO_PACKAGE_BOUNDARY

Kind: `value`
Module: `src/index.ts`
Source: `src/index.ts:39:14`

## STUDIO_PACKAGE_NAME

Kind: `value`
Module: `src/index.ts`
Source: `src/index.ts:31:14`

## STUDIO_PUBLIC_CONTRACTS

Kind: `value`
Module: `src/index.ts`
Source: `src/index.ts:67:14`

## StudioActionPayloadField

Kind: `type`
Module: `src/index.ts`
Source: `src/index.ts:253:1`

### Members

| Name     | Kind     | Type                           | Required | Description |
| -------- | -------- | ------------------------------ | -------- | ----------- |
| label    | property | `string`                       | yes      |             |
| required | property | `boolean \| undefined`         | no       |             |
| type     | property | `StudioActionPayloadPrimitive` | yes      |             |

## StudioActionPayloadPrimitive

Kind: `unknown`
Module: `src/index.ts`
Source: `src/index.ts:251:1`

## StudioActionPayloadSchema

Kind: `unknown`
Module: `src/index.ts`
Source: `src/index.ts:259:1`

## StudioAdminRouteId

Kind: `unknown`
Module: `src/index.ts`
Source: `src/index.ts:99:1`

## StudioAdminRoutePath

Kind: `unknown`
Module: `src/index.ts`
Source: `src/index.ts:122:1`

## StudioAdminStaticRoutePath

Kind: `unknown`
Module: `src/index.ts`
Source: `src/index.ts:111:1`

## StudioCommand

Kind: `unknown`
Module: `src/index.ts`
Source: `src/index.ts:294:1`

## StudioComponentBlueprint

Kind: `type`
Module: `src/index.ts`
Source: `src/index.ts:278:1`

### Members

| Name         | Kind     | Type                                   | Required | Description |
| ------------ | -------- | -------------------------------------- | -------- | ----------- |
| defaultProps | property | `Record<string, unknown> \| undefined` | no       |             |
| label        | property | `string \| undefined`                  | no       |             |

## StudioComponentMeta

Kind: `type`
Module: `src/index.ts`
Source: `src/index.ts:283:1`

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
Source: `src/index.ts:290:1`

## StudioContextValue

Kind: `type`
Module: `src/index.ts`
Source: `src/index.ts:310:1`

### Members

| Name                      | Kind     | Type                                                                  | Required | Description |
| ------------------------- | -------- | --------------------------------------------------------------------- | -------- | ----------- |
| activeAdminRouteId        | property | `StudioAdminRouteId`                                                  | yes      |             |
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
| lastNonAdminLocation      | property | `string`                                                              | yes      |             |
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
| setActiveAdminRouteId     | property | `(routeId: StudioAdminRouteId) => void`                               | yes      |             |
| setActiveCanvasDragNodeId | property | `(nodeId: StudioNodeId \| null) => void`                              | yes      |             |
| setActiveLocale           | property | `(locale: StudioLocale) => void`                                      | yes      |             |
| setActivePanelId          | property | `(panelId: StudioPanelId \| null) => void`                            | yes      |             |
| setActiveScreenId         | property | `(id: StudioScreenId) => void`                                        | yes      |             |
| setActiveThemeId          | property | `(id: string) => void`                                                | yes      |             |
| setActiveThemeMode        | property | `(mode: StudioMode) => void`                                          | yes      |             |
| setLastNonAdminLocation   | property | `(location: string) => void`                                          | yes      |             |
| setNavigatorInitialRoute  | property | `(routeName: string) => void`                                         | yes      |             |
| setNavigatorType          | property | `(type: NavigatorType) => void`                                       | yes      |             |
| setStudioMode             | property | `(mode: StudioMode) => void`                                          | yes      |             |
| studioMode                | property | `StudioMode`                                                          | yes      |             |
| t                         | property | `(key: string) => string`                                             | yes      |             |
| togglePreviewMode         | property | `() => void`                                                          | yes      |             |
| updateAppData             | property | `(data: AppDataManifest) => void`                                     | yes      |             |
| updateAuthSettings        | property | `(settings: StudioAuthSettings) => void`                              | yes      |             |
| updateDataBindings        | property | `(dataBindings: ComponentDataBindingRegistry) => void`                | yes      |             |
| updateDataSources         | property | `(dataSources: DataSourceRegistry) => void`                           | yes      |             |
| updateModuleConfig        | property | `(moduleId: StudioModuleId, config: Record<string, unknown>) => void` | yes      |             |
| updateNode                | property | `(nodeId: StudioNodeId, props: Record<string, unknown>) => void`      | yes      |             |
| updateOAuthProviders      | property | `(providers: AuthOAuthProviderConfig[]) => void`                      | yes      |             |
| updateTheme               | property | `(id: string, updates: ThemeUpdates) => void`                         | yes      |             |

## StudioEvent

Kind: `unknown`
Module: `src/index.ts`
Source: `src/index.ts:303:1`

## StudioIdGenerator

Kind: `unknown`
Module: `src/index.ts`
Source: `src/index.ts:292:1`

## StudioLocale

Kind: `unknown`
Module: `src/index.ts`
Source: `src/index.ts:94:1`

## StudioManifest

Kind: `unknown`
Module: `src/index.ts`
Source: `src/index.ts:124:1`

## StudioMode

Kind: `unknown`
Module: `src/index.ts`
Source: `src/index.ts:96:1`

## StudioModuleId

Kind: `unknown`
Module: `src/index.ts`
Source: `src/index.ts:93:1`

## StudioNodeId

Kind: `unknown`
Module: `src/index.ts`
Source: `src/index.ts:91:1`

## StudioPackageBoundary

Kind: `type`
Module: `src/index.ts`
Source: `src/index.ts:33:1`

### Members

| Name       | Kind     | Type                | Required | Description |
| ---------- | -------- | ------------------- | -------- | ----------- |
| consumes   | property | `readonly string[]` | yes      |             |
| doesNotOwn | property | `readonly string[]` | yes      |             |
| owns       | property | `readonly string[]` | yes      |             |

## StudioPanelId

Kind: `unknown`
Module: `src/index.ts`
Source: `src/index.ts:98:1`

## StudioProjectId

Kind: `unknown`
Module: `src/index.ts`
Source: `src/index.ts:89:1`

## StudioPublicContract

Kind: `unknown`
Module: `src/index.ts`
Source: `src/index.ts:87:1`

## StudioSaveStatus

Kind: `unknown`
Module: `src/index.ts`
Source: `src/index.ts:97:1`

## StudioScreenId

Kind: `unknown`
Module: `src/index.ts`
Source: `src/index.ts:92:1`

## StudioSelectionState

Kind: `type`
Module: `src/index.ts`
Source: `src/index.ts:135:1`

### Members

| Name                   | Kind     | Type                    | Required | Description |
| ---------------------- | -------- | ----------------------- | -------- | ----------- |
| activeAdminRouteId     | property | `StudioAdminRouteId`    | yes      |             |
| activeCanvasDragNodeId | property | `string \| null`        | yes      |             |
| activePanelId          | property | `StudioPanelId \| null` | yes      |             |
| activeScreenId         | property | `string \| null`        | yes      |             |
| selectedNodeId         | property | `string \| null`        | yes      |             |

## StudioSessionId

Kind: `unknown`
Module: `src/index.ts`
Source: `src/index.ts:90:1`

## StudioSessionState

Kind: `type`
Module: `src/index.ts`
Source: `src/index.ts:143:1`

### Members

| Name                 | Kind     | Type                  | Required | Description |
| -------------------- | -------- | --------------------- | -------- | ----------- |
| activeLocale         | property | `string`              | yes      |             |
| error                | property | `string \| null`      | yes      |             |
| isLoading            | property | `boolean`             | yes      |             |
| lastNonAdminLocation | property | `string`              | yes      |             |
| previewMode          | property | `boolean`             | yes      |             |
| projectId            | property | `string`              | yes      |             |
| saveStatus           | property | `StudioSaveStatus`    | yes      |             |
| sessionId            | property | `string \| undefined` | no       |             |
| studioMode           | property | `StudioMode`          | yes      |             |

## ThemeUpdates

Kind: `unknown`
Module: `src/index.ts`
Source: `src/index.ts:130:1`

## TPL_SCREEN_EMPTY

Kind: `value`
Module: `src/index.ts`
Source: `src/index.ts:441:14`

## updateNodeInTree

Kind: `value`
Module: `src/index.ts`
Source: `src/index.ts:525:14`

### Signatures

- `(root: UiNode, id: string, newProps: Record<string, unknown>) => UiNode`
  - id: `string`
  - newProps: `Record<string, unknown>`
  - root: `UiNode`
  - returns: `UiNode`

## validateInsertRecipe

Kind: `function`
Module: `src/index.ts`
Source: `src/index.ts:1145:1`

### Signatures

- `(recipe: InsertRecipe, componentMeta: StudioComponentMetaRegistry) => InsertRecipeIssue | null`
  - componentMeta: `StudioComponentMetaRegistry`
  - recipe: `InsertRecipe`
  - returns: `InsertRecipeIssue | null`

## validateNodePlacement

Kind: `function`
Module: `src/index.ts`
Source: `src/index.ts:742:1`

### Signatures

- `(args: { root: UiNode; placement: NodePlacement; childType: string; componentMeta: StudioComponentMetaRegistry; }) => PlacementValidationResult`
  - args: `{ root: UiNode; placement: NodePlacement; childType: string; componentMeta: StudioComponentMetaRegistry; }`
  - returns: `PlacementValidationResult`
