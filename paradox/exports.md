# Public API

## ActionDefinition

Kind: `type`
Module: `src/index.ts`
Source: `src/index.ts:212:1`

### Members

| Name            | Kind     | Type                                     | Required | Description |
| --------------- | -------- | ---------------------------------------- | -------- | ----------- |
| description     | property | `string`                                 | yes      |             |
| label           | property | `string`                                 | yes      |             |
| payloadSchema   | property | `StudioActionPayloadSchema \| undefined` | no       |             |
| requiresPayload | property | `boolean`                                | yes      |             |
| type            | property | `ActionType`                             | yes      |             |

## InsertCatalogComponentEntry

Kind: `type`
Module: `src/index.ts`
Source: `src/index.ts:190:1`

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
Source: `src/index.ts:172:1`

### Members

| Name   | Kind     | Type                              | Required | Description |
| ------ | -------- | --------------------------------- | -------- | ----------- |
| code   | property | `InsertCatalogDisabledReasonCode` | yes      |             |
| detail | property | `string`                          | yes      |             |
| issue  | property | `InsertRecipeIssue \| undefined`  | no       |             |

## InsertCatalogDisabledReasonCode

Kind: `unknown`
Module: `src/index.ts`
Source: `src/index.ts:149:1`

## InsertCatalogEntry

Kind: `unknown`
Module: `src/index.ts`
Source: `src/index.ts:200:1`

## InsertCatalogEntryBase

Kind: `type`
Module: `src/index.ts`
Source: `src/index.ts:178:1`

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
Source: `src/index.ts:146:1`

## InsertCatalogEntryStatus

Kind: `unknown`
Module: `src/index.ts`
Source: `src/index.ts:147:1`

## InsertCatalogRecipeEntry

Kind: `type`
Module: `src/index.ts`
Source: `src/index.ts:195:1`

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

## InsertRecipe

Kind: `type`
Module: `src/index.ts`
Source: `src/index.ts:157:1`

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
Source: `src/index.ts:165:1`

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
Source: `src/index.ts:152:1`

### Members

| Name     | Kind     | Type                              | Required | Description |
| -------- | -------- | --------------------------------- | -------- | ----------- |
| children | property | `InsertRecipeNode[] \| undefined` | no       |             |
| type     | property | `string`                          | yes      |             |

## ModuleDefinition

Kind: `type`
Module: `src/index.ts`
Source: `src/index.ts:220:1`

### Members

| Name        | Kind     | Type                                           | Required | Description |
| ----------- | -------- | ---------------------------------------------- | -------- | ----------- |
| description | property | `string`                                       | yes      |             |
| id          | property | `string`                                       | yes      |             |
| name        | property | `string`                                       | yes      |             |
| ui          | property | `{ modal?: { title: string; }; } \| undefined` | no       |             |

## NodePlacement

Kind: `type`
Module: `src/index.ts`
Source: `src/index.ts:108:1`

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
Source: `src/index.ts:115:1`

## PlacementFailureReason

Kind: `type`
Module: `src/index.ts`
Source: `src/index.ts:127:1`

### Members

| Name    | Kind     | Type                   | Required | Description |
| ------- | -------- | ---------------------- | -------- | ----------- |
| code    | property | `PlacementFailureCode` | yes      |             |
| message | property | `string`               | yes      |             |

## PlacementKind

Kind: `unknown`
Module: `src/index.ts`
Source: `src/index.ts:106:1`

## PlacementResolutionResult

Kind: `unknown`
Module: `src/index.ts`
Source: `src/index.ts:139:1`

## PlacementValidationResult

Kind: `unknown`
Module: `src/index.ts`
Source: `src/index.ts:132:1`

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
Source: `src/index.ts:50:14`

## StudioActionPayloadField

Kind: `type`
Module: `src/index.ts`
Source: `src/index.ts:204:1`

### Members

| Name     | Kind     | Type                           | Required | Description |
| -------- | -------- | ------------------------------ | -------- | ----------- |
| label    | property | `string`                       | yes      |             |
| required | property | `boolean \| undefined`         | no       |             |
| type     | property | `StudioActionPayloadPrimitive` | yes      |             |

## StudioActionPayloadPrimitive

Kind: `unknown`
Module: `src/index.ts`
Source: `src/index.ts:202:1`

## StudioActionPayloadSchema

Kind: `unknown`
Module: `src/index.ts`
Source: `src/index.ts:210:1`

## StudioAdminRoutePath

Kind: `unknown`
Module: `src/index.ts`
Source: `src/index.ts:73:1`

## StudioCommand

Kind: `unknown`
Module: `src/index.ts`
Source: `src/index.ts:229:1`

## StudioContextValue

Kind: `type`
Module: `src/index.ts`
Source: `src/index.ts:245:1`

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
Source: `src/index.ts:238:1`

## StudioLocale

Kind: `unknown`
Module: `src/index.ts`
Source: `src/index.ts:68:1`

## StudioManifest

Kind: `unknown`
Module: `src/index.ts`
Source: `src/index.ts:76:1`

## StudioMode

Kind: `unknown`
Module: `src/index.ts`
Source: `src/index.ts:70:1`

## StudioModuleId

Kind: `unknown`
Module: `src/index.ts`
Source: `src/index.ts:67:1`

## StudioNodeId

Kind: `unknown`
Module: `src/index.ts`
Source: `src/index.ts:65:1`

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
Source: `src/index.ts:72:1`

## StudioProjectId

Kind: `unknown`
Module: `src/index.ts`
Source: `src/index.ts:63:1`

## StudioPublicContract

Kind: `unknown`
Module: `src/index.ts`
Source: `src/index.ts:61:1`

## StudioSaveStatus

Kind: `unknown`
Module: `src/index.ts`
Source: `src/index.ts:71:1`

## StudioScreenId

Kind: `unknown`
Module: `src/index.ts`
Source: `src/index.ts:66:1`

## StudioSelectionState

Kind: `type`
Module: `src/index.ts`
Source: `src/index.ts:87:1`

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
Source: `src/index.ts:64:1`

## StudioSessionState

Kind: `type`
Module: `src/index.ts`
Source: `src/index.ts:95:1`

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
Source: `src/index.ts:82:1`
