# Public API

## ACTION_REGISTRY

Kind: `value`
Module: `src/index.ts`
Source: `src/index.ts:431:14`

## ActionDefinition

Kind: `type`
Module: `src/index.ts`
Source: `src/index.ts:340:1`

### Members

| Name            | Kind     | Type                                     | Required | Description |
| --------------- | -------- | ---------------------------------------- | -------- | ----------- |
| description     | property | `string`                                 | yes      |             |
| label           | property | `string`                                 | yes      |             |
| payloadSchema   | property | `StudioActionPayloadSchema \| undefined` | no       |             |
| requiresPayload | property | `boolean`                                | yes      |             |
| type            | property | `ActionType`                             | yes      |             |

## appendStudioEventBinding

Kind: `function`
Module: `src/bindingMutationModel.ts`
Source: `src/bindingMutationModel.ts:34:1`

### Signatures

- `(registry: Readonly<Record<string, ComponentDataBinding>>, node: UiNode, eventName: string, binding: EventBinding) => Readonly<Record<string, ComponentDataBinding>>`
  - binding: `EventBinding`
  - eventName: `string`
  - node: `UiNode`
  - registry: `Readonly<Record<string, ComponentDataBinding>>`
  - returns: `Readonly<Record<string, ComponentDataBinding>>`

## assessStudioBindingCompatibility

Kind: `function`
Module: `src/bindingSchemaModel.ts`
Source: `src/bindingSchemaModel.ts:43:1`

### Signatures

- `(expected: UiBindableValueMeta, actual: UiBindableValueMeta) => StudioBindingCompatibility`
  - actual: `UiBindableValueMeta`
  - expected: `UiBindableValueMeta`
  - returns: `StudioBindingCompatibility`

## buildInsertCatalogEntries

Kind: `function`
Module: `src/index.ts`
Source: `src/index.ts:1373:1`

### Signatures

- `(args: { componentMeta: StudioComponentMetaRegistry; recipes?: readonly InsertRecipe[]; }) => InsertCatalogEntry[]`
  - args: `{ componentMeta: StudioComponentMetaRegistry; recipes?: readonly InsertRecipe[]; }`
  - returns: `InsertCatalogEntry[]`

## canAcceptChild

Kind: `function`
Module: `src/index.ts`
Source: `src/index.ts:749:1`

### Signatures

- `(args: { parentType: string; childType: string; componentMeta: StudioComponentMetaRegistry; }) => boolean`
  - args: `{ parentType: string; childType: string; componentMeta: StudioComponentMetaRegistry; }`
  - returns: `boolean`

## cloneWithNewIds

Kind: `value`
Module: `src/index.ts`
Source: `src/index.ts:578:14`

### Signatures

- `(node: UiNode, createId?: StudioIdGenerator) => UiNode`
  - createId: `StudioIdGenerator` (optional)
  - node: `UiNode`
  - returns: `UiNode`

## collectStudioBindingOperationOptions

Kind: `function`
Module: `src/bindingOperationModel.ts`
Source: `src/bindingOperationModel.ts:16:1`

### Signatures

- `(dataSources: Readonly<Record<string, DataSourceConfig>>) => readonly StudioBindingOperationOption[]`
  - dataSources: `Readonly<Record<string, DataSourceConfig>>`
  - returns: `readonly StudioBindingOperationOption[]`

## collectStudioMediaAssetUsages

Kind: `function`
Module: `src/mediaAuthoringModel.ts`
Source: `src/mediaAuthoringModel.ts:115:1`

### Signatures

- `(manifest: AppManifest, mediaId: string) => readonly StudioMediaUsage[]`
  - manifest: `AppManifest`
  - mediaId: `string`
  - returns: `readonly StudioMediaUsage[]`

## collectStudioResponsePaths

Kind: `function`
Module: `src/bindingSchemaModel.ts`
Source: `src/bindingSchemaModel.ts:33:1`

### Signatures

- `(schema: DataSchema | undefined, schemas: Readonly<Record<string, DataSchema>> | undefined) => readonly StudioBindingResponsePathOption[]`
  - schema: `DataSchema | undefined`
  - schemas: `Readonly<Record<string, DataSchema>> | undefined`
  - returns: `readonly StudioBindingResponsePathOption[]`

## createNodeFromCatalogEntry

Kind: `function`
Module: `src/index.ts`
Source: `src/index.ts:1292:1`

### Signatures

- `(entry: InsertCatalogEntry, componentMeta: StudioComponentMetaRegistry, createId?: StudioIdGenerator) => UiNode`
  - componentMeta: `StudioComponentMetaRegistry`
  - createId: `StudioIdGenerator` (optional)
  - entry: `InsertCatalogEntry`
  - returns: `UiNode`

## createStudioActionInputFields

Kind: `function`
Module: `src/bindingOperationModel.ts`
Source: `src/bindingOperationModel.ts:95:1`

### Signatures

- `(payloadSchema: Readonly<Record<string, { readonly label: string; readonly type: string; readonly required?: boolean; }>> | undefined) => readonly StudioBindingInputFieldOption[]`
  - payloadSchema: `Readonly<Record<string, { readonly label: string; readonly type: string; readonly required?: boolean; }>> | undefined`
  - returns: `readonly StudioBindingInputFieldOption[]`

## createStudioInstancePropertyPatch

Kind: `function`
Module: `src/propertiesAuthoringModel.ts`
Source: `src/propertiesAuthoringModel.ts:92:1`

### Signatures

- `(node: UiNode, propertyName: string, value: StudioInstancePropertyValue | undefined) => Readonly<Record<string, unknown>>`
  - node: `UiNode`
  - propertyName: `string`
  - value: `StudioInstancePropertyValue | undefined`
  - returns: `Readonly<Record<string, unknown>>`

## createStudioMediaAssetId

Kind: `function`
Module: `src/mediaAuthoringModel.ts`
Source: `src/mediaAuthoringModel.ts:71:1`

### Signatures

- `(name: string, registry?: Readonly<Record<string, MediaAsset>>) => string`
  - name: `string`
  - registry: `Readonly<Record<string, MediaAsset>>` (optional)
  - returns: `string`

## createStudioMediaAssetReference

Kind: `function`
Module: `src/mediaAuthoringModel.ts`
Source: `src/mediaAuthoringModel.ts:59:1`

### Signatures

- `(mediaId: string) => MediaAssetReference`
  - mediaId: `string`
  - returns: `MediaAssetReference`

## createStudioUrlMediaAsset

Kind: `function`
Module: `src/mediaAuthoringModel.ts`
Source: `src/mediaAuthoringModel.ts:84:1`

### Signatures

- `(args: { readonly id: string; readonly name: string; readonly kind: MediaAssetKind; readonly url: string; }) => StudioUrlMediaAssetResult`
  - args: `{ readonly id: string; readonly name: string; readonly kind: MediaAssetKind; readonly url: string; }`
  - returns: `StudioUrlMediaAssetResult`

## deriveProjectId

Kind: `function`
Module: `src/projectIdentity.ts`
Source: `src/projectIdentity.ts:11:1`

### Signatures

- `(projectName: string) => string`
  - projectName: `string`
  - returns: `string`

## diagnoseStudioComponentBindings

Kind: `function`
Module: `src/bindingDiagnosticsModel.ts`
Source: `src/bindingDiagnosticsModel.ts:20:1`

### Signatures

- `(args: { readonly node: UiNode; readonly registry: ComponentDataBindingRegistry; readonly componentMeta: UiComponentMetaRegistry; readonly operations: readonly StudioBindingOperationOption[]; readonly actionTypes: readonly string[]; }) => readonly StudioBindingDiagnostic[]`
  - args: `{ readonly node: UiNode; readonly registry: ComponentDataBindingRegistry; readonly componentMeta: UiComponentMetaRegistry; readonly operations: readonly StudioBindingOperationOption[]; readonly actionTypes: readonly string[]; }`
  - returns: `readonly StudioBindingDiagnostic[]`

## findNodeById

Kind: `value`
Module: `src/index.ts`
Source: `src/index.ts:595:14`

### Signatures

- `(root: UiNode, id: string) => UiNode | null`
  - id: `string`
  - root: `UiNode`
  - returns: `UiNode | null`

## findStudioBindingOperationOption

Kind: `function`
Module: `src/bindingOperationModel.ts`
Source: `src/bindingOperationModel.ts:24:1`

### Signatures

- `(options: readonly StudioBindingOperationOption[], ref: BindingOperationRef) => StudioBindingOperationOption | undefined`
  - options: `readonly StudioBindingOperationOption[]`
  - ref: `BindingOperationRef`
  - returns: `StudioBindingOperationOption | undefined`

## generateStudioId

Kind: `value`
Module: `src/index.ts`
Source: `src/index.ts:571:14`

### Signatures

- `(prefix?: string | undefined) => string`
  - prefix: `string | undefined` (optional)
  - returns: `string`

## getInsertCatalogCategoryLabel

Kind: `function`
Module: `src/index.ts`
Source: `src/index.ts:1218:1`

### Signatures

- `(category: string) => string`
  - category: `string`
  - returns: `string`

## InsertCatalogComponentEntry

Kind: `type`
Module: `src/index.ts`
Source: `src/index.ts:318:1`

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
Source: `src/index.ts:300:1`

### Members

| Name   | Kind     | Type                              | Required | Description |
| ------ | -------- | --------------------------------- | -------- | ----------- |
| code   | property | `InsertCatalogDisabledReasonCode` | yes      |             |
| detail | property | `string`                          | yes      |             |
| issue  | property | `InsertRecipeIssue \| undefined`  | no       |             |

## InsertCatalogDisabledReasonCode

Kind: `unknown`
Module: `src/index.ts`
Source: `src/index.ts:277:1`

## InsertCatalogEntry

Kind: `unknown`
Module: `src/index.ts`
Source: `src/index.ts:328:1`

## InsertCatalogEntryBase

Kind: `type`
Module: `src/index.ts`
Source: `src/index.ts:306:1`

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
Source: `src/index.ts:274:1`

## InsertCatalogEntryStatus

Kind: `unknown`
Module: `src/index.ts`
Source: `src/index.ts:275:1`

## InsertCatalogRecipeEntry

Kind: `type`
Module: `src/index.ts`
Source: `src/index.ts:323:1`

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
Source: `src/index.ts:1011:1`

### Signatures

- `(args: InsertNodeAtPlacementArgs) => InsertNodeAtPlacementResult | null`
  - args: `InsertNodeAtPlacementArgs`
  - returns: `InsertNodeAtPlacementResult | null`

## InsertNodeAtPlacementArgs

Kind: `type`
Module: `src/index.ts`
Source: `src/index.ts:954:1`

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
Source: `src/index.ts:961:1`

### Members

| Name           | Kind     | Type     | Required | Description |
| -------------- | -------- | -------- | -------- | ----------- |
| insertedNodeId | property | `string` | yes      |             |
| root           | property | `UiNode` | yes      |             |

## InsertRecipe

Kind: `type`
Module: `src/index.ts`
Source: `src/index.ts:285:1`

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
Source: `src/index.ts:293:1`

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
Source: `src/index.ts:280:1`

### Members

| Name     | Kind     | Type                              | Required | Description |
| -------- | -------- | --------------------------------- | -------- | ----------- |
| children | property | `InsertRecipeNode[] \| undefined` | no       |             |
| type     | property | `string`                          | yes      |             |

## listStudioMediaAssets

Kind: `function`
Module: `src/mediaAuthoringModel.ts`
Source: `src/mediaAuthoringModel.ts:48:1`

### Signatures

- `(manifest: AppManifest, mediaKinds?: readonly ("file" | "image" | "audio" | "video" | "font")[] | undefined) => readonly MediaAsset[]`
  - manifest: `AppManifest`
  - mediaKinds: `readonly ("file" | "image" | "audio" | "video" | "font")[] | undefined` (optional)
  - returns: `readonly MediaAsset[]`

## moveNodeToPlacement

Kind: `function`
Module: `src/index.ts`
Source: `src/index.ts:1147:1`

### Signatures

- `(args: MoveNodeToPlacementArgs) => MoveNodeToPlacementResult | null`
  - args: `MoveNodeToPlacementArgs`
  - returns: `MoveNodeToPlacementResult | null`

## MoveNodeToPlacementArgs

Kind: `type`
Module: `src/index.ts`
Source: `src/index.ts:1038:1`

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
Source: `src/index.ts:1045:1`

### Members

| Name        | Kind     | Type     | Required | Description |
| ----------- | -------- | -------- | -------- | ----------- |
| movedNodeId | property | `string` | yes      |             |
| root        | property | `UiNode` | yes      |             |

## NodePlacement

Kind: `type`
Module: `src/index.ts`
Source: `src/index.ts:235:1`

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
Source: `src/index.ts:242:1`

## PlacementFailureReason

Kind: `type`
Module: `src/index.ts`
Source: `src/index.ts:255:1`

### Members

| Name    | Kind     | Type                   | Required | Description |
| ------- | -------- | ---------------------- | -------- | ----------- |
| code    | property | `PlacementFailureCode` | yes      |             |
| message | property | `string`               | yes      |             |

## PlacementKind

Kind: `unknown`
Module: `src/index.ts`
Source: `src/index.ts:233:1`

## PlacementResolutionResult

Kind: `unknown`
Module: `src/index.ts`
Source: `src/index.ts:267:1`

## PlacementValidationResult

Kind: `unknown`
Module: `src/index.ts`
Source: `src/index.ts:260:1`

## ProjectAuthDiagnostic

Kind: `type`
Module: `src/projectAuthHealth.ts`
Source: `src/projectAuthHealth.ts:14:1`

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
Source: `src/projectAuthHealth.ts:12:1`

## ProjectAuthHealth

Kind: `type`
Module: `src/projectAuthHealth.ts`
Source: `src/projectAuthHealth.ts:37:1`

### Members

| Name         | Kind     | Type                                                                                                | Required | Description |
| ------------ | -------- | --------------------------------------------------------------------------------------------------- | -------- | ----------- |
| callbackUrls | property | `{ readonly appCallbackRoute: string; readonly providerRedirectUrl?: string; }`                     | yes      |             |
| diagnostics  | property | `readonly ProjectAuthDiagnostic[]`                                                                  | yes      |             |
| providers    | property | `readonly ProjectOAuthProviderHealth[]`                                                             | yes      |             |
| setup        | property | `{ readonly environment: AppDeployEnvironmentId; readonly targets: readonly AppDeployTargetId[]; }` | yes      |             |
| status       | property | `ProjectAuthHealthStatus`                                                                           | yes      |             |

## ProjectAuthHealthStatus

Kind: `unknown`
Module: `src/projectAuthHealth.ts`
Source: `src/projectAuthHealth.ts:10:1`

## ProjectCreationValidationCode

Kind: `unknown`
Module: `src/projectWorkspaceContracts.ts`
Source: `src/projectWorkspaceContracts.ts:18:1`

## ProjectCreationValidationError

Kind: `type`
Module: `src/projectIdentity.ts`
Source: `src/projectIdentity.ts:28:1`

## ProjectCreationValidationFailure

Kind: `type`
Module: `src/projectWorkspaceContracts.ts`
Source: `src/projectWorkspaceContracts.ts:25:1`

### Members

| Name    | Kind     | Type                            | Required | Description |
| ------- | -------- | ------------------------------- | -------- | ----------- |
| code    | property | `ProjectCreationValidationCode` | yes      |             |
| message | property | `string`                        | yes      |             |

## ProjectCreationValidationResult

Kind: `unknown`
Module: `src/projectWorkspaceContracts.ts`
Source: `src/projectWorkspaceContracts.ts:30:1`

## ProjectOAuthProviderHealth

Kind: `type`
Module: `src/projectAuthHealth.ts`
Source: `src/projectAuthHealth.ts:26:1`

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
Source: `src/projectAuthHealth.ts:23:1`

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

## ProjectSortKey

Kind: `unknown`
Module: `src/projectWorkspaceContracts.ts`
Source: `src/projectWorkspaceContracts.ts:16:1`

## readStudioMediaAssetReference

Kind: `function`
Module: `src/mediaAuthoringModel.ts`
Source: `src/mediaAuthoringModel.ts:63:1`

### Signatures

- `(value: unknown) => MediaAssetReference | null`
  - value: `unknown`
  - returns: `MediaAssetReference | null`

## removeNodeFromTree

Kind: `value`
Module: `src/index.ts`
Source: `src/index.ts:635:14`

### Signatures

- `(root: UiNode, nodeId: string) => UiNode | null`
  - nodeId: `string`
  - root: `UiNode`
  - returns: `UiNode | null`

## removeStudioEventBinding

Kind: `function`
Module: `src/bindingMutationModel.ts`
Source: `src/bindingMutationModel.ts:50:1`

### Signatures

- `(registry: Readonly<Record<string, ComponentDataBinding>>, node: UiNode, eventName: string, bindingIndex: number) => Readonly<Record<string, ComponentDataBinding>>`
  - bindingIndex: `number`
  - eventName: `string`
  - node: `UiNode`
  - registry: `Readonly<Record<string, ComponentDataBinding>>`
  - returns: `Readonly<Record<string, ComponentDataBinding>>`

## removeStudioMediaAsset

Kind: `function`
Module: `src/mediaAuthoringModel.ts`
Source: `src/mediaAuthoringModel.ts:126:1`

### Signatures

- `(manifest: AppManifest, mediaId: string) => StudioMediaAssetRemovalResult`
  - manifest: `AppManifest`
  - mediaId: `string`
  - returns: `StudioMediaAssetRemovalResult`

## removeStudioPropBinding

Kind: `function`
Module: `src/bindingMutationModel.ts`
Source: `src/bindingMutationModel.ts:22:1`

### Signatures

- `(registry: Readonly<Record<string, ComponentDataBinding>>, node: UiNode, propName: string) => Readonly<Record<string, ComponentDataBinding>>`
  - node: `UiNode`
  - propName: `string`
  - registry: `Readonly<Record<string, ComponentDataBinding>>`
  - returns: `Readonly<Record<string, ComponentDataBinding>>`

## resolveDefaultInsertPlacement

Kind: `function`
Module: `src/index.ts`
Source: `src/index.ts:909:1`

### Signatures

- `(args: { root: UiNode; selectedNodeId: string | null; childType: string; componentMeta: StudioComponentMetaRegistry; }) => PlacementResolutionResult`
  - args: `{ root: UiNode; selectedNodeId: string | null; childType: string; componentMeta: StudioComponentMetaRegistry; }`
  - returns: `PlacementResolutionResult`

## resolveInsertCatalogEntries

Kind: `function`
Module: `src/index.ts`
Source: `src/index.ts:1415:1`

### Signatures

- `(args: { entries: readonly InsertCatalogEntry[]; root: UiNode | null; selectedNodeId: string | null; componentMeta: StudioComponentMetaRegistry; }) => InsertCatalogEntry[]`
  - args: `{ entries: readonly InsertCatalogEntry[]; root: UiNode | null; selectedNodeId: string | null; componentMeta: StudioComponentMetaRegistry; }`
  - returns: `InsertCatalogEntry[]`

## resolveInsertPlacement

Kind: `function`
Module: `src/index.ts`
Source: `src/index.ts:848:1`

### Signatures

- `(args: { root: UiNode; targetNodeId: string; childType: string; componentMeta: StudioComponentMetaRegistry; kind: PlacementKind; }) => PlacementResolutionResult`
  - args: `{ root: UiNode; targetNodeId: string; childType: string; componentMeta: StudioComponentMetaRegistry; kind: PlacementKind; }`
  - returns: `PlacementResolutionResult`

## resolveMoveNodePlacement

Kind: `function`
Module: `src/index.ts`
Source: `src/index.ts:1079:1`

### Signatures

- `(args: MoveNodeToPlacementArgs) => PlacementResolutionResult`
  - args: `MoveNodeToPlacementArgs`
  - returns: `PlacementResolutionResult`

## resolveStudioBindableEvents

Kind: `function`
Module: `src/bindingMetadataModel.ts`
Source: `src/bindingMetadataModel.ts:21:1`

### Signatures

- `(node: UiNode, registry: Readonly<Record<string, import("@ankhorage/contracts/dist/ui").UiComponentMeta>>) => readonly StudioBindableEventOption[]`
  - node: `UiNode`
  - registry: `Readonly<Record<string, import("@ankhorage/contracts/dist/ui").UiComponentMeta>>`
  - returns: `readonly StudioBindableEventOption[]`

## resolveStudioBindableProps

Kind: `function`
Module: `src/bindingMetadataModel.ts`
Source: `src/bindingMetadataModel.ts:8:1`

### Signatures

- `(node: UiNode, registry: Readonly<Record<string, import("@ankhorage/contracts/dist/ui").UiComponentMeta>>) => readonly StudioBindablePropOption[]`
  - node: `UiNode`
  - registry: `Readonly<Record<string, import("@ankhorage/contracts/dist/ui").UiComponentMeta>>`
  - returns: `readonly StudioBindablePropOption[]`

## resolveStudioInstancePropertyFields

Kind: `function`
Module: `src/propertiesAuthoringModel.ts`
Source: `src/propertiesAuthoringModel.ts:47:1`

### Signatures

- `(node: UiNode, registry: Readonly<Record<string, StudioAuthoringComponentMeta | undefined>>) => readonly StudioInstancePropertyField[]`
  - node: `UiNode`
  - registry: `Readonly<Record<string, StudioAuthoringComponentMeta | undefined>>`
  - returns: `readonly StudioInstancePropertyField[]`

## resolveStudioInstancePropertyGroups

Kind: `function`
Module: `src/propertiesAuthoringModel.ts`
Source: `src/propertiesAuthoringModel.ts:77:1`

### Signatures

- `(node: UiNode, registry: Readonly<Record<string, StudioAuthoringComponentMeta | undefined>>) => readonly StudioInstancePropertyGroup[]`
  - node: `UiNode`
  - registry: `Readonly<Record<string, StudioAuthoringComponentMeta | undefined>>`
  - returns: `readonly StudioInstancePropertyGroup[]`

## resolveStudioSchemaValueMeta

Kind: `function`
Module: `src/bindingSchemaModel.ts`
Source: `src/bindingSchemaModel.ts:14:1`

### Signatures

- `(schema: DataSchema | undefined, schemas: Readonly<Record<string, DataSchema>> | undefined, seen?: ReadonlySet<string>) => UiBindableValueMeta`
  - schema: `DataSchema | undefined`
  - schemas: `Readonly<Record<string, DataSchema>> | undefined`
  - seen: `ReadonlySet<string>` (optional)
  - returns: `UiBindableValueMeta`

## STUDIO_INSERT_RECIPES

Kind: `value`
Module: `src/index.ts`
Source: `src/index.ts:1185:14`

| id             | label          | description                              | category |
| -------------- | -------------- | ---------------------------------------- | -------- |
| screen-section | Screen section | A screen section with a starter heading. | recipe   |
| panel-stack    | Panel stack    | Panel with a stack starter.              | recipe   |
| card-heading   | Card heading   | Card with a headline.                    | recipe   |

## STUDIO_PACKAGE_BOUNDARY

Kind: `value`
Module: `src/index.ts`
Source: `src/index.ts:76:14`

## STUDIO_PACKAGE_NAME

Kind: `value`
Module: `src/index.ts`
Source: `src/index.ts:68:14`

## STUDIO_PUBLIC_CONTRACTS

Kind: `value`
Module: `src/index.ts`
Source: `src/index.ts:109:14`

## StudioActionPayloadField

Kind: `type`
Module: `src/index.ts`
Source: `src/index.ts:332:1`

### Members

| Name     | Kind     | Type                           | Required | Description |
| -------- | -------- | ------------------------------ | -------- | ----------- |
| label    | property | `string`                       | yes      |             |
| required | property | `boolean \| undefined`         | no       |             |
| type     | property | `StudioActionPayloadPrimitive` | yes      |             |

## StudioActionPayloadPrimitive

Kind: `unknown`
Module: `src/index.ts`
Source: `src/index.ts:330:1`

## StudioActionPayloadSchema

Kind: `unknown`
Module: `src/index.ts`
Source: `src/index.ts:338:1`

## StudioAdminRouteId

Kind: `unknown`
Module: `src/index.ts`
Source: `src/index.ts:153:1`

## StudioAdminRoutePath

Kind: `unknown`
Module: `src/index.ts`
Source: `src/index.ts:199:1`

## StudioAdminStaticRoutePath

Kind: `unknown`
Module: `src/index.ts`
Source: `src/index.ts:179:1`

## StudioAuthoringComponentMeta

Kind: `type`
Module: `src/propertiesAuthoringModel.ts`
Source: `src/propertiesAuthoringModel.ts:15:1`

### Members

| Name  | Kind     | Type                                                  | Required | Description |
| ----- | -------- | ----------------------------------------------------- | -------- | ----------- |
| name  | property | `string`                                              | yes      |             |
| props | property | `Readonly<Record<string, StudioAuthoringPropSchema>>` | yes      |             |

## StudioAuthoringMetaRegistry

Kind: `unknown`
Module: `src/propertiesAuthoringModel.ts`
Source: `src/propertiesAuthoringModel.ts:20:1`

## StudioAuthoringPropSchema

Kind: `type`
Module: `src/propertiesAuthoringModel.ts`
Source: `src/propertiesAuthoringModel.ts:3:1`

### Members

| Name       | Kind     | Type                                                                          | Required | Description |
| ---------- | -------- | ----------------------------------------------------------------------------- | -------- | ----------- |
| authoring  | property | `{ readonly authority: string; } \| undefined`                                | no       |             |
| category   | property | `string`                                                                      | yes      |             |
| default    | property | `unknown`                                                                     | no       |             |
| enum       | property | `readonly (string \| number)[] \| undefined`                                  | no       |             |
| label      | property | `string \| undefined`                                                         | no       |             |
| mediaKinds | property | `readonly ("file" \| "image" \| "audio" \| "video" \| "font")[] \| undefined` | no       |             |
| type       | property | `string`                                                                      | yes      |             |

## StudioBindableEventOption

Kind: `type`
Module: `src/bindingAuthoringContracts.ts`
Source: `src/bindingAuthoringContracts.ts:16:1`

### Members

| Name  | Kind     | Type                  | Required | Description |
| ----- | -------- | --------------------- | -------- | ----------- |
| label | property | `string`              | yes      |             |
| meta  | property | `UiBindableEventMeta` | yes      |             |
| name  | property | `string`              | yes      |             |

## StudioBindablePropOption

Kind: `type`
Module: `src/bindingAuthoringContracts.ts`
Source: `src/bindingAuthoringContracts.ts:10:1`

### Members

| Name  | Kind     | Type                 | Required | Description |
| ----- | -------- | -------------------- | -------- | ----------- |
| label | property | `string`             | yes      |             |
| meta  | property | `UiBindablePropMeta` | yes      |             |
| name  | property | `string`             | yes      |             |

## StudioBindingCompatibility

Kind: `unknown`
Module: `src/bindingAuthoringContracts.ts`
Source: `src/bindingAuthoringContracts.ts:8:1`

## StudioBindingDiagnostic

Kind: `type`
Module: `src/bindingAuthoringContracts.ts`
Source: `src/bindingAuthoringContracts.ts:43:1`

### Members

| Name     | Kind     | Type                                                                                                                                                                                                      | Required | Description |
| -------- | -------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------- | ----------- |
| code     | property | `"incompatible-input" \| "incompatible-response" \| "missing-action" \| "missing-binding-meta" \| "missing-input" \| "missing-operation" \| "missing-response-path" \| "unknown-event" \| "unknown-prop"` | yes      |             |
| message  | property | `string`                                                                                                                                                                                                  | yes      |             |
| path     | property | `string \| undefined`                                                                                                                                                                                     | no       |             |
| severity | property | `"warning" \| "error"`                                                                                                                                                                                    | yes      |             |

## StudioBindingInputFieldOption

Kind: `type`
Module: `src/bindingAuthoringContracts.ts`
Source: `src/bindingAuthoringContracts.ts:22:1`

### Members

| Name     | Kind     | Type                  | Required | Description |
| -------- | -------- | --------------------- | -------- | ----------- |
| label    | property | `string`              | yes      |             |
| name     | property | `string`              | yes      |             |
| required | property | `boolean`             | yes      |             |
| value    | property | `UiBindableValueMeta` | yes      |             |

## StudioBindingOperationOption

Kind: `type`
Module: `src/bindingAuthoringContracts.ts`
Source: `src/bindingAuthoringContracts.ts:35:1`

### Members

| Name          | Kind     | Type                                         | Required | Description |
| ------------- | -------- | -------------------------------------------- | -------- | ----------- |
| inputFields   | property | `readonly StudioBindingInputFieldOption[]`   | yes      |             |
| label         | property | `string`                                     | yes      |             |
| operation     | property | `BindingOperationRef`                        | yes      |             |
| responsePaths | property | `readonly StudioBindingResponsePathOption[]` | yes      |             |
| sourceLabel   | property | `string`                                     | yes      |             |

## StudioBindingResponsePathOption

Kind: `type`
Module: `src/bindingAuthoringContracts.ts`
Source: `src/bindingAuthoringContracts.ts:29:1`

### Members

| Name  | Kind     | Type                  | Required | Description |
| ----- | -------- | --------------------- | -------- | ----------- |
| label | property | `string`              | yes      |             |
| path  | property | `string`              | yes      |             |
| value | property | `UiBindableValueMeta` | yes      |             |

## StudioCommand

Kind: `unknown`
Module: `src/index.ts`
Source: `src/index.ts:364:1`

## StudioComponentBlueprint

Kind: `type`
Module: `src/index.ts`
Source: `src/index.ts:348:1`

### Members

| Name         | Kind     | Type                                   | Required | Description |
| ------------ | -------- | -------------------------------------- | -------- | ----------- |
| defaultProps | property | `Record<string, unknown> \| undefined` | no       |             |
| label        | property | `string \| undefined`                  | no       |             |

## StudioComponentMeta

Kind: `type`
Module: `src/index.ts`
Source: `src/index.ts:353:1`

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
Source: `src/index.ts:360:1`

## StudioContextValue

Kind: `type`
Module: `src/index.ts`
Source: `src/index.ts:379:1`

### Members

| Name                                | Kind     | Type                                                                                                      | Required | Description |
| ----------------------------------- | -------- | --------------------------------------------------------------------------------------------------------- | -------- | ----------- |
| activeAdminRouteId                  | property | `StudioAdminRouteId`                                                                                      | yes      |             |
| activeCanvasDragNodeId              | property | `string \| null`                                                                                          | yes      |             |
| activePanelId                       | property | `"layers" \| null`                                                                                        | yes      |             |
| activeScreenId                      | property | `string \| null`                                                                                          | yes      |             |
| addScreen                           | property | `(name: string) => void`                                                                                  | yes      |             |
| addTheme                            | property | `() => void`                                                                                              | yes      |             |
| componentMeta                       | property | `StudioComponentMetaRegistry`                                                                             | yes      |             |
| deleteGeneratedApi                  | property | `(id: string) => void`                                                                                    | yes      |             |
| deleteMediaAsset                    | property | `(mediaId: string) => Promise<StudioMediaDeleteResult>`                                                   | yes      |             |
| deleteNode                          | property | `(id: StudioNodeId) => void`                                                                              | yes      |             |
| deleteScreen                        | property | `(id: StudioScreenId) => void`                                                                            | yes      |             |
| deleteTheme                         | property | `(id: string) => void`                                                                                    | yes      |             |
| error                               | property | `string \| null`                                                                                          | yes      |             |
| findNode                            | property | `(root: UiNode, id: StudioNodeId) => UiNode \| null`                                                      | yes      |             |
| flushManifest                       | property | `() => Promise<void>`                                                                                     | yes      |             |
| ingestMediaFromPicker               | property | `(source: StudioMediaPickerSource, target?: StudioMediaIngestTarget) => Promise<StudioMediaIngestResult>` | yes      |             |
| insertFromCatalogEntry              | property | `(entry: InsertCatalogEntry) => boolean`                                                                  | yes      |             |
| isLoading                           | property | `boolean`                                                                                                 | yes      |             |
| lastNonAdminLocation                | property | `string`                                                                                                  | yes      |             |
| manifest                            | property | `AppManifest \| null`                                                                                     | yes      |             |
| mediaPickerAvailable                | property | `boolean`                                                                                                 | yes      |             |
| moveNodeToPlacement                 | property | `(nodeId: StudioNodeId, placement: NodePlacement) => boolean`                                             | yes      |             |
| moveRoute                           | property | `(parentPath: string[], routeName: string, toIndex: number) => void`                                      | yes      |             |
| mutateAuthSettings                  | property | `(mutation: StudioAuthSettingsMutation) => StudioAuthSettings \| null`                                    | yes      |             |
| previewMode                         | property | `boolean`                                                                                                 | yes      |             |
| projectId                           | property | `string`                                                                                                  | yes      |             |
| refetchManifest                     | property | `() => Promise<void>`                                                                                     | yes      |             |
| removeMediaAsset                    | property | `(mediaId: string) => boolean`                                                                            | yes      |             |
| rootNode                            | property | `UiNode \| null`                                                                                          | yes      |             |
| saveStatus                          | property | `StudioSaveStatus`                                                                                        | yes      |             |
| selectedNodeId                      | property | `string \| null`                                                                                          | yes      |             |
| selectNode                          | property | `(id: StudioNodeId \| null) => void`                                                                      | yes      |             |
| sessionId                           | property | `string \| undefined`                                                                                     | no       |             |
| setActiveAdminRouteId               | property | `(routeId: StudioAdminRouteId) => void`                                                                   | yes      |             |
| setActiveCanvasDragNodeId           | property | `(nodeId: StudioNodeId \| null) => void`                                                                  | yes      |             |
| setActivePanelId                    | property | `(panelId: StudioPanelId \| null) => void`                                                                | yes      |             |
| setActiveScreenId                   | property | `(id: StudioScreenId) => void`                                                                            | yes      |             |
| setActiveThemeId                    | property | `(id: string) => void`                                                                                    | yes      |             |
| setLastNonAdminLocation             | property | `(location: string) => void`                                                                              | yes      |             |
| setNavigatorInitialRoute            | property | `(routeName: string) => void`                                                                             | yes      |             |
| setNavigatorType                    | property | `(type: NavigatorType) => void`                                                                           | yes      |             |
| setRoutePrimaryNavigationVisibility | property | `(parentPath: string[], routeName: string, showInPrimaryNavigation: boolean) => void`                     | yes      |             |
| togglePreviewMode                   | property | `() => void`                                                                                              | yes      |             |
| updateAuthSettings                  | property | `(settings: StudioAuthSettings) => void`                                                                  | yes      |             |
| updateDataBindings                  | property | `(dataBindings: ComponentDataBindingRegistry) => void`                                                    | yes      |             |
| updateDataSources                   | property | `(dataSources: DataSourceRegistry) => void`                                                               | yes      |             |
| updateNode                          | property | `(nodeId: StudioNodeId, props: Record<string, unknown>) => void`                                          | yes      |             |
| updateOAuthProviders                | property | `(providers: AuthOAuthProviderConfig[]) => void`                                                          | yes      |             |
| updateTheme                         | property | `(id: string, updates: ThemeUpdates) => void`                                                             | yes      |             |
| upsertGeneratedApi                  | property | `(definition: GeneratedApiDefinition, previousId?: string) => readonly DataSourceDiagnostic[]`            | yes      |             |
| upsertMediaAsset                    | property | `(asset: MediaAsset) => void`                                                                             | yes      |             |

## StudioEvent

Kind: `unknown`
Module: `src/index.ts`
Source: `src/index.ts:372:1`

## StudioIdGenerator

Kind: `unknown`
Module: `src/index.ts`
Source: `src/index.ts:362:1`

## StudioInstancePropertyEditorKind

Kind: `unknown`
Module: `src/propertiesAuthoringModel.ts`
Source: `src/propertiesAuthoringModel.ts:24:1`

## StudioInstancePropertyField

Kind: `type`
Module: `src/propertiesAuthoringModel.ts`
Source: `src/propertiesAuthoringModel.ts:27:1`

### Members

| Name         | Kind     | Type                                                                          | Required | Description |
| ------------ | -------- | ----------------------------------------------------------------------------- | -------- | ----------- |
| category     | property | `string`                                                                      | yes      |             |
| defaultValue | property | `unknown`                                                                     | yes      |             |
| editor       | property | `StudioInstancePropertyEditorKind`                                            | yes      |             |
| isExplicit   | property | `boolean`                                                                     | yes      |             |
| label        | property | `string`                                                                      | yes      |             |
| mediaKinds   | property | `readonly ("file" \| "image" \| "audio" \| "video" \| "font")[] \| undefined` | no       |             |
| name         | property | `string`                                                                      | yes      |             |
| options      | property | `readonly (string \| number)[]`                                               | yes      |             |
| schemaType   | property | `string`                                                                      | yes      |             |
| value        | property | `unknown`                                                                     | yes      |             |

## StudioInstancePropertyGroup

Kind: `type`
Module: `src/propertiesAuthoringModel.ts`
Source: `src/propertiesAuthoringModel.ts:40:1`

### Members

| Name     | Kind     | Type                                     | Required | Description |
| -------- | -------- | ---------------------------------------- | -------- | ----------- |
| category | property | `string`                                 | yes      |             |
| fields   | property | `readonly StudioInstancePropertyField[]` | yes      |             |

## StudioInstancePropertyValue

Kind: `unknown`
Module: `src/propertiesAuthoringModel.ts`
Source: `src/propertiesAuthoringModel.ts:45:1`

## StudioManifest

Kind: `unknown`
Module: `src/index.ts`
Source: `src/index.ts:208:1`

## StudioMediaAssetRemovalResult

Kind: `unknown`
Module: `src/mediaAuthoringModel.ts`
Source: `src/mediaAuthoringModel.ts:16:1`

## StudioMediaDeleteResult

Kind: `unknown`
Module: `src/mediaAuthoringModel.ts`
Source: `src/mediaAuthoringModel.ts:24:1`

## StudioMediaIngestResult

Kind: `unknown`
Module: `src/mediaPickerAuthoring.ts`
Source: `src/mediaPickerAuthoring.ts:33:1`

## StudioMediaIngestTarget

Kind: `unknown`
Module: `src/mediaPickerAuthoring.ts`
Source: `src/mediaPickerAuthoring.ts:4:1`

## StudioMediaPickerAdapter

Kind: `type`
Module: `src/mediaPickerAuthoring.ts`
Source: `src/mediaPickerAuthoring.ts:29:1`

### Members

| Name | Kind   | Type                                                                  | Required | Description |
| ---- | ------ | --------------------------------------------------------------------- | -------- | ----------- |
| pick | method | `(input: StudioMediaPickerInput) => Promise<StudioMediaPickerResult>` | yes      |             |

## StudioMediaPickerFailureReason

Kind: `unknown`
Module: `src/mediaPickerAuthoring.ts`
Source: `src/mediaPickerAuthoring.ts:22:1`

## StudioMediaPickerInput

Kind: `type`
Module: `src/mediaPickerAuthoring.ts`
Source: `src/mediaPickerAuthoring.ts:6:1`

### Members

| Name       | Kind     | Type                                                                          | Required | Description |
| ---------- | -------- | ----------------------------------------------------------------------------- | -------- | ----------- |
| mediaKinds | property | `readonly ("file" \| "image" \| "audio" \| "video" \| "font")[] \| undefined` | no       |             |
| source     | property | `StudioMediaPickerSource`                                                     | yes      |             |

## StudioMediaPickerResult

Kind: `unknown`
Module: `src/mediaPickerAuthoring.ts`
Source: `src/mediaPickerAuthoring.ts:25:1`

## StudioMediaPickerSelection

Kind: `type`
Module: `src/mediaPickerAuthoring.ts`
Source: `src/mediaPickerAuthoring.ts:11:1`

### Members

| Name        | Kind     | Type                                                | Required | Description |
| ----------- | -------- | --------------------------------------------------- | -------- | ----------- |
| body        | property | `Uint8Array`                                        | yes      |             |
| contentType | property | `string \| undefined`                               | no       |             |
| durationMs  | property | `number \| undefined`                               | no       |             |
| height      | property | `number \| undefined`                               | no       |             |
| kind        | property | `"file" \| "image" \| "audio" \| "video" \| "font"` | yes      |             |
| name        | property | `string`                                            | yes      |             |
| sizeBytes   | property | `number \| undefined`                               | no       |             |
| width       | property | `number \| undefined`                               | no       |             |

## StudioMediaPickerSource

Kind: `unknown`
Module: `src/mediaPickerAuthoring.ts`
Source: `src/mediaPickerAuthoring.ts:3:1`

## StudioMediaUsage

Kind: `type`
Module: `src/mediaAuthoringModel.ts`
Source: `src/mediaAuthoringModel.ts:10:1`

### Members

| Name         | Kind     | Type     | Required | Description |
| ------------ | -------- | -------- | -------- | ----------- |
| nodeId       | property | `string` | yes      |             |
| propertyPath | property | `string` | yes      |             |
| screenId     | property | `string` | yes      |             |

## StudioModuleAdminContribution

Kind: `type`
Module: `src/moduleAdminContracts.ts`
Source: `src/moduleAdminContracts.ts:11:1`

### Members

| Name        | Kind     | Type                                | Required | Description |
| ----------- | -------- | ----------------------------------- | -------- | ----------- |
| description | property | `string`                            | yes      |             |
| fields      | property | `readonly StudioModuleAdminField[]` | yes      |             |
| kind        | property | `"config-schema"`                   | yes      |             |
| title       | property | `string`                            | yes      |             |

## StudioModuleAdminControl

Kind: `unknown`
Module: `src/moduleAdminContracts.ts`
Source: `src/moduleAdminContracts.ts:2:1`

## StudioModuleAdminField

Kind: `type`
Module: `src/moduleAdminContracts.ts`
Source: `src/moduleAdminContracts.ts:4:1`

### Members

| Name     | Kind     | Type      | Required | Description |
| -------- | -------- | --------- | -------- | ----------- |
| control  | property | `string`  | yes      |             |
| key      | property | `string`  | yes      |             |
| label    | property | `string`  | yes      |             |
| required | property | `boolean` | yes      |             |

## StudioModuleId

Kind: `unknown`
Module: `src/index.ts`
Source: `src/index.ts:149:1`

## StudioModuleOperationResult

Kind: `type`
Module: `src/moduleAdminContracts.ts`
Source: `src/moduleAdminContracts.ts:35:1`

### Members

| Name         | Kind     | Type                             | Required | Description |
| ------------ | -------- | -------------------------------- | -------- | ----------- |
| installed    | property | `readonly string[] \| undefined` | no       |             |
| module       | property | `StudioModuleState \| null`      | yes      |             |
| needsReload  | property | `boolean`                        | yes      |             |
| pending      | property | `boolean \| undefined`           | no       |             |
| reconfigured | property | `string \| undefined`            | no       |             |
| success      | property | `true`                           | yes      |             |

## StudioModuleState

Kind: `type`
Module: `src/moduleAdminContracts.ts`
Source: `src/moduleAdminContracts.ts:18:1`

### Members

| Name                | Kind     | Type                                    | Required | Description |
| ------------------- | -------- | --------------------------------------- | -------- | ----------- |
| admin               | property | `StudioModuleAdminContribution \| null` | yes      |             |
| adminError          | property | `string \| undefined`                   | no       |             |
| available           | property | `boolean`                               | yes      |             |
| config              | property | `unknown`                               | yes      |             |
| dependencies        | property | `readonly string[]`                     | yes      |             |
| dependents          | property | `readonly string[]`                     | yes      |             |
| description         | property | `string`                                | yes      |             |
| id                  | property | `string`                                | yes      |             |
| installed           | property | `boolean`                               | yes      |             |
| installedAt         | property | `string \| undefined`                   | no       |             |
| installedVersion    | property | `string \| undefined`                   | no       |             |
| name                | property | `string`                                | yes      |             |
| pendingRemoval      | property | `boolean`                               | yes      |             |
| registrationVersion | property | `string \| undefined`                   | no       |             |

## StudioNodeId

Kind: `unknown`
Module: `src/index.ts`
Source: `src/index.ts:147:1`

## StudioPackageBoundary

Kind: `type`
Module: `src/index.ts`
Source: `src/index.ts:70:1`

### Members

| Name       | Kind     | Type                | Required | Description |
| ---------- | -------- | ------------------- | -------- | ----------- |
| consumes   | property | `readonly string[]` | yes      |             |
| doesNotOwn | property | `readonly string[]` | yes      |             |
| owns       | property | `readonly string[]` | yes      |             |

## StudioPanelId

Kind: `unknown`
Module: `src/index.ts`
Source: `src/index.ts:152:1`

## StudioProjectId

Kind: `unknown`
Module: `src/index.ts`
Source: `src/index.ts:145:1`

## StudioProjectSummary

Kind: `type`
Module: `src/projectWorkspaceContracts.ts`
Source: `src/projectWorkspaceContracts.ts:3:1`

### Members

| Name            | Kind     | Type                                                                                                                                                                                                                                                                                                                                                                                                                                          | Required | Description |
| --------------- | -------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------- | ----------- |
| activeTheme     | property | `ThemeConfig`                                                                                                                                                                                                                                                                                                                                                                                                                                 | yes      |             |
| activeThemeMode | property | `"dark" \| "light" \| undefined`                                                                                                                                                                                                                                                                                                                                                                                                              | no       |             |
| category        | property | `"books_reading" \| "business_productivity" \| "developer_tools" \| "education_learning" \| "entertainment_media" \| "finance_money" \| "food_drink" \| "games" \| "graphics_design" \| "health_fitness" \| "kids_family" \| "lifestyle" \| "medical" \| "music_audio" \| "navigation_travel" \| "news_magazines" \| "photo_video" \| "reference" \| "shopping_commerce" \| "social_community" \| "sports" \| "utilities_tools" \| "weather"` | yes      |             |
| created         | property | `string \| undefined`                                                                                                                                                                                                                                                                                                                                                                                                                         | no       |             |
| id              | property | `string`                                                                                                                                                                                                                                                                                                                                                                                                                                      | yes      |             |
| isAnkhApp       | property | `boolean`                                                                                                                                                                                                                                                                                                                                                                                                                                     | yes      |             |
| name            | property | `string`                                                                                                                                                                                                                                                                                                                                                                                                                                      | yes      |             |
| path            | property | `string`                                                                                                                                                                                                                                                                                                                                                                                                                                      | yes      |             |
| updated         | property | `string \| undefined`                                                                                                                                                                                                                                                                                                                                                                                                                         | no       |             |
| version         | property | `string`                                                                                                                                                                                                                                                                                                                                                                                                                                      | yes      |             |

## StudioPublicContract

Kind: `unknown`
Module: `src/index.ts`
Source: `src/index.ts:143:1`

## StudioSaveStatus

Kind: `unknown`
Module: `src/index.ts`
Source: `src/index.ts:151:1`

## StudioScreenId

Kind: `unknown`
Module: `src/index.ts`
Source: `src/index.ts:148:1`

## StudioSelectionState

Kind: `type`
Module: `src/index.ts`
Source: `src/index.ts:215:1`

### Members

| Name                   | Kind     | Type                 | Required | Description |
| ---------------------- | -------- | -------------------- | -------- | ----------- |
| activeAdminRouteId     | property | `StudioAdminRouteId` | yes      |             |
| activeCanvasDragNodeId | property | `string \| null`     | yes      |             |
| activePanelId          | property | `"layers" \| null`   | yes      |             |
| activeScreenId         | property | `string \| null`     | yes      |             |
| selectedNodeId         | property | `string \| null`     | yes      |             |

## StudioSessionId

Kind: `unknown`
Module: `src/index.ts`
Source: `src/index.ts:146:1`

## StudioSessionState

Kind: `type`
Module: `src/index.ts`
Source: `src/index.ts:223:1`

### Members

| Name                 | Kind     | Type                  | Required | Description |
| -------------------- | -------- | --------------------- | -------- | ----------- |
| error                | property | `string \| null`      | yes      |             |
| isLoading            | property | `boolean`             | yes      |             |
| lastNonAdminLocation | property | `string`              | yes      |             |
| previewMode          | property | `boolean`             | yes      |             |
| projectId            | property | `string`              | yes      |             |
| saveStatus           | property | `StudioSaveStatus`    | yes      |             |
| sessionId            | property | `string \| undefined` | no       |             |

## StudioUrlMediaAssetResult

Kind: `unknown`
Module: `src/mediaAuthoringModel.ts`
Source: `src/mediaAuthoringModel.ts:44:1`

## TemplateCatalog

Kind: `type`
Module: `src/templateCatalogContracts.ts`
Source: `src/templateCatalogContracts.ts:21:1`

### Members

| Name       | Kind     | Type                        | Required | Description |
| ---------- | -------- | --------------------------- | -------- | ----------- |
| categories | property | `TemplateCatalogCategory[]` | yes      |             |

## TemplateCatalogCategory

Kind: `type`
Module: `src/templateCatalogContracts.ts`
Source: `src/templateCatalogContracts.ts:10:1`

### Members

| Name          | Kind     | Type                                                                                                                                                                                                                                                                                                                                                                                                                                          | Required | Description |
| ------------- | -------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------- | ----------- |
| focusAreas    | property | `readonly string[]`                                                                                                                                                                                                                                                                                                                                                                                                                           | yes      |             |
| harmony       | property | `"monochromatic" \| "analogous" \| "complementary" \| "triadic" \| "tetradic" \| "splitComplementary"`                                                                                                                                                                                                                                                                                                                                        | yes      |             |
| id            | property | `"books_reading" \| "business_productivity" \| "developer_tools" \| "education_learning" \| "entertainment_media" \| "finance_money" \| "food_drink" \| "games" \| "graphics_design" \| "health_fitness" \| "kids_family" \| "lifestyle" \| "medical" \| "music_audio" \| "navigation_travel" \| "news_magazines" \| "photo_video" \| "reference" \| "shopping_commerce" \| "social_community" \| "sports" \| "utilities_tools" \| "weather"` | yes      |             |
| label         | property | `string`                                                                                                                                                                                                                                                                                                                                                                                                                                      | yes      |             |
| primaryColor  | property | `string`                                                                                                                                                                                                                                                                                                                                                                                                                                      | yes      |             |
| summary       | property | `string`                                                                                                                                                                                                                                                                                                                                                                                                                                      | yes      |             |
| templateCount | property | `number`                                                                                                                                                                                                                                                                                                                                                                                                                                      | yes      |             |
| templates     | property | `TemplateCatalogTemplate[]`                                                                                                                                                                                                                                                                                                                                                                                                                   | yes      |             |

## TemplateCatalogTemplate

Kind: `type`
Module: `src/templateCatalogContracts.ts`
Source: `src/templateCatalogContracts.ts:3:1`

### Members

| Name        | Kind     | Type     | Required | Description |
| ----------- | -------- | -------- | -------- | ----------- |
| description | property | `string` | yes      |             |
| id          | property | `string` | yes      |             |
| name        | property | `string` | yes      |             |
| templateId  | property | `string` | yes      |             |

## TemplateEntry

Kind: `unknown`
Module: `src/templateCatalogContracts.ts`
Source: `src/templateCatalogContracts.ts:25:1`

## ThemeUpdates

Kind: `unknown`
Module: `src/index.ts`
Source: `src/index.ts:210:1`

## TPL_SCREEN_EMPTY

Kind: `value`
Module: `src/index.ts`
Source: `src/index.ts:523:14`

## updateNodeInTree

Kind: `value`
Module: `src/index.ts`
Source: `src/index.ts:607:14`

### Signatures

- `(root: UiNode, id: string, newProps: Record<string, unknown>) => UiNode`
  - id: `string`
  - newProps: `Record<string, unknown>`
  - root: `UiNode`
  - returns: `UiNode`

## upsertStudioMediaAsset

Kind: `function`
Module: `src/mediaAuthoringModel.ts`
Source: `src/mediaAuthoringModel.ts:103:1`

### Signatures

- `(manifest: AppManifest, asset: MediaAsset) => AppManifest`
  - asset: `MediaAsset`
  - manifest: `AppManifest`
  - returns: `AppManifest`

## upsertStudioPropBinding

Kind: `function`
Module: `src/bindingMutationModel.ts`
Source: `src/bindingMutationModel.ts:9:1`

### Signatures

- `(registry: Readonly<Record<string, ComponentDataBinding>>, node: UiNode, propName: string, binding: PropBinding) => Readonly<Record<string, ComponentDataBinding>>`
  - binding: `PropBinding`
  - node: `UiNode`
  - propName: `string`
  - registry: `Readonly<Record<string, ComponentDataBinding>>`
  - returns: `Readonly<Record<string, ComponentDataBinding>>`

## validateInsertRecipe

Kind: `function`
Module: `src/index.ts`
Source: `src/index.ts:1235:1`

### Signatures

- `(recipe: InsertRecipe, componentMeta: StudioComponentMetaRegistry) => InsertRecipeIssue | null`
  - componentMeta: `StudioComponentMetaRegistry`
  - recipe: `InsertRecipe`
  - returns: `InsertRecipeIssue | null`

## validateNodePlacement

Kind: `function`
Module: `src/index.ts`
Source: `src/index.ts:761:1`

### Signatures

- `(args: { root: UiNode; placement: NodePlacement; childType: string; componentMeta: StudioComponentMetaRegistry; }) => PlacementValidationResult`
  - args: `{ root: UiNode; placement: NodePlacement; childType: string; componentMeta: StudioComponentMetaRegistry; }`
  - returns: `PlacementValidationResult`

## validateProjectCreationInput

Kind: `function`
Module: `src/projectIdentity.ts`
Source: `src/projectIdentity.ts:35:1`

### Signatures

- `(args: { name: string; existingProjects: readonly StudioProjectSummary[]; }) => ProjectCreationValidationResult`
  - args: `{ name: string; existingProjects: readonly StudioProjectSummary[]; }`
  - returns: `ProjectCreationValidationResult`
