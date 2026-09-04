# Public API

## ACTION_REGISTRY

Kind: `value`
Module: `src/index.ts`
Source: `src/index.ts:445:14`

## ActionDefinition

Kind: `type`
Module: `src/index.ts`
Source: `src/index.ts:359:1`

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
Source: `src/bindingMutationModel.ts:46:1`

Append an event binding to one Studio node/event pair without replacing earlier bindings.
@todo Move binding mutation behavior under src/bindings/.

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
Source: `src/bindingSchemaModel.ts:55:1`

Assess whether an actual bindable value shape can satisfy an expected Studio binding shape.
@todo Keep binding compatibility policy under src/bindings/.

### Signatures

- `(expected: UiBindableValueMeta, actual: UiBindableValueMeta) => StudioBindingCompatibility`
  - actual: `UiBindableValueMeta`
  - expected: `UiBindableValueMeta`
  - returns: `StudioBindingCompatibility`

## buildInsertCatalogEntries

Kind: `function`
Module: `src/index.ts`
Source: `src/index.ts:1426:1`

Build and deterministically sort Studio's component/recipe insert catalog from component metadata and recipes.
@todo Move insert-catalog construction from `src/index.ts` into the insert domain.

### Signatures

- `(args: { componentMeta: StudioComponentMetaRegistry; recipes?: readonly InsertRecipe[]; }) => InsertCatalogEntry[]`
  - args: `{ componentMeta: StudioComponentMetaRegistry; recipes?: readonly InsertRecipe[]; }`
  - returns: `InsertCatalogEntry[]`

## canAcceptChild

Kind: `function`
Module: `src/index.ts`
Source: `src/index.ts:744:1`

Return whether Studio component metadata permits one child type under a parent type.
@todo Move this component-placement policy from `src/index.ts` into the `canvas/` or insert-authoring domain.

### Signatures

- `(args: { parentType: string; childType: string; componentMeta: StudioComponentMetaRegistry; }) => boolean`
  - args: `{ parentType: string; childType: string; componentMeta: StudioComponentMetaRegistry; }`
  - returns: `boolean`

## cloneWithNewIds

Kind: `value`
Module: `src/index.ts`
Source: `src/index.ts:596:14`

Deep-clone a UiNode tree while assigning fresh identifiers and shallow-cloning node props.
@utility @ankhorage/utility/tree
@todo `cloneTreeWithNewIds` currently allocates child ids before the root; retain this public pre-order callback contract until Utility supports configurable traversal order.

### Signatures

- `(node: UiNode, createId?: StudioIdGenerator) => UiNode`
  - createId: `StudioIdGenerator` (optional)
  - node: `UiNode`
  - returns: `UiNode`

## collectStudioBindingOperationOptions

Kind: `function`
Module: `src/bindingOperationModel.ts`
Source: `src/bindingOperationModel.ts:21:1`

Collect and alphabetically sort the API operations available for Studio binding authoring.
@todo Move binding operation catalog behavior under src/bindings/.

### Signatures

- `(apis: ApiDefinitionList) => readonly StudioBindingOperationOption[]`
  - apis: `ApiDefinitionList`
  - returns: `readonly StudioBindingOperationOption[]`

## collectStudioMediaAssetUsages

Kind: `function`
Module: `src/mediaAuthoringModel.ts`
Source: `src/mediaAuthoringModel.ts:138:1`

Collect every Studio node-property usage of one media asset across all manifest screens.
@todo Move media usage analysis under src/media/ while extracting generic deep-value traversal.

### Signatures

- `(manifest: AppManifest, mediaId: string) => readonly StudioMediaUsage[]`
  - manifest: `AppManifest`
  - mediaId: `string`
  - returns: `readonly StudioMediaUsage[]`

## collectStudioResponsePaths

Kind: `function`
Module: `src/bindingSchemaModel.ts`
Source: `src/bindingSchemaModel.ts:41:1`

Collect response-path options from a schema for Studio binding authoring.
@todo Move response-path authoring under src/bindings/.

### Signatures

- `(schema: DataSchema | undefined, schemas: Readonly<Record<string, DataSchema>> | undefined) => readonly StudioBindingResponsePathOption[]`
  - schema: `DataSchema | undefined`
  - schemas: `Readonly<Record<string, DataSchema>> | undefined`
  - returns: `readonly StudioBindingResponsePathOption[]`

## createNodeFromCatalogEntry

Kind: `function`
Module: `src/index.ts`
Source: `src/index.ts:1339:1`

Materialize one enabled component or recipe catalog entry into a fresh UiNode tree.
@todo Move insert-catalog node creation from `src/index.ts` into the insert domain.

### Signatures

- `(entry: InsertCatalogEntry, componentMeta: StudioComponentMetaRegistry, createId?: StudioIdGenerator) => UiNode`
  - componentMeta: `StudioComponentMetaRegistry`
  - createId: `StudioIdGenerator` (optional)
  - entry: `InsertCatalogEntry`
  - returns: `UiNode`

## createStudioActionInputFields

Kind: `function`
Module: `src/bindingOperationModel.ts`
Source: `src/bindingOperationModel.ts:122:1`

Convert an action payload schema into Studio binding input-field options.
@todo Move action binding-field projection under src/bindings/.

### Signatures

- `(payloadSchema: Readonly<Record<string, { readonly label: string; readonly type: string; readonly required?: boolean; }>> | undefined) => readonly StudioBindingInputFieldOption[]`
  - payloadSchema: `Readonly<Record<string, { readonly label: string; readonly type: string; readonly required?: boolean; }>> | undefined`
  - returns: `readonly StudioBindingInputFieldOption[]`

## createStudioInstancePropertyPatch

Kind: `function`
Module: `src/propertiesAuthoringModel.ts`
Source: `src/propertiesAuthoringModel.ts:105:1`

Create an immutable props patch that removes a property for undefined or replaces it for a defined value.
@utility @ankhorage/utility/object

### Signatures

- `(node: UiNode, propertyName: string, value: StudioInstancePropertyValue | undefined) => Readonly<Record<string, unknown>>`
  - node: `UiNode`
  - propertyName: `string`
  - value: `StudioInstancePropertyValue | undefined`
  - returns: `Readonly<Record<string, unknown>>`

## createStudioMediaAssetId

Kind: `function`
Module: `src/mediaAuthoringModel.ts`
Source: `src/mediaAuthoringModel.ts:88:1`

Create a unique slug-like media id from a name and an existing keyed registry.
@utility @ankhorage/utility/string

### Signatures

- `(name: string, registry?: Readonly<Record<string, MediaAsset>>) => string`
  - name: `string`
  - registry: `Readonly<Record<string, MediaAsset>>` (optional)
  - returns: `string`

## createStudioMediaAssetReference

Kind: `function`
Module: `src/mediaAuthoringModel.ts`
Source: `src/mediaAuthoringModel.ts:68:1`

Create the canonical media-reference object for one media id.
@todo Keep the MediaAssetReference constructor with its contracts/media owner unless a generic single-key reference constructor is extracted.

### Signatures

- `(mediaId: string) => MediaAssetReference`
  - mediaId: `string`
  - returns: `MediaAssetReference`

## createStudioUrlMediaAsset

Kind: `function`
Module: `src/mediaAuthoringModel.ts`
Source: `src/mediaAuthoringModel.ts:105:1`

Create a URL-backed Studio media asset after validating and normalizing its HTTP URL.
@todo Move URL-media authoring behavior under src/media/ while reusing generic URL normalization.

### Signatures

- `(args: { readonly id: string; readonly name: string; readonly kind: MediaAssetKind; readonly url: string; }) => StudioUrlMediaAssetResult`
  - args: `{ readonly id: string; readonly name: string; readonly kind: MediaAssetKind; readonly url: string; }`
  - returns: `StudioUrlMediaAssetResult`

## deriveProjectId

Kind: `function`
Module: `src/projectIdentity.ts`
Source: `src/projectIdentity.ts:15:1`

Normalize a project name into a lowercase hyphenated identifier.
@utility @ankhorage/utility/string

### Signatures

- `(projectName: string) => string`
  - projectName: `string`
  - returns: `string`

## diagnoseStudioComponentBindings

Kind: `function`
Module: `src/bindingDiagnosticsModel.ts`
Source: `src/bindingDiagnosticsModel.ts:25:1`

Diagnose all authored prop and event bindings for one Studio component node.
@todo Move binding diagnostics under src/bindings/.

### Signatures

- `(args: { readonly node: UiNode; readonly registry: ComponentDataBindingRegistry; readonly componentMeta: UiComponentMetaRegistry; readonly operations: readonly StudioBindingOperationOption[]; readonly actionTypes: readonly string[]; }) => readonly StudioBindingDiagnostic[]`
  - args: `{ readonly node: UiNode; readonly registry: ComponentDataBindingRegistry; readonly componentMeta: UiComponentMetaRegistry; readonly operations: readonly StudioBindingOperationOption[]; readonly actionTypes: readonly string[]; }`
  - returns: `readonly StudioBindingDiagnostic[]`

## findNodeById

Kind: `value`
Module: `src/index.ts`
Source: `src/index.ts:618:14`

Find the first node with a matching id in a depth-first tree traversal.
@utility @ankhorage/utility/tree
@todo Move the UiNode wrapper out of `src/index.ts`; parameterize id and child accessors for Utility.

### Signatures

- `(root: UiNode, id: string) => UiNode | null`
  - id: `string`
  - root: `UiNode`
  - returns: `UiNode | null`

## findStudioBindingOperationOption

Kind: `function`
Module: `src/bindingOperationModel.ts`
Source: `src/bindingOperationModel.ts:32:1`

Find an option through the canonical keyed array lookup utility.

### Signatures

- `(options: readonly StudioBindingOperationOption[], ref: BindingOperationRef) => StudioBindingOperationOption | undefined`
  - options: `readonly StudioBindingOperationOption[]`
  - ref: `BindingOperationRef`
  - returns: `StudioBindingOperationOption | undefined`

## generateStudioId

Kind: `value`
Module: `src/index.ts`
Source: `src/index.ts:587:14`

Generate a compact time/random identifier with an optional lowercase prefix.
@utility @ankhorage/utility/id
@todo Move the Studio-facing wrapper out of `src/index.ts`; the reusable identifier primitive belongs in Utility.

### Signatures

- `(prefix?: string | undefined) => string`
  - prefix: `string | undefined` (optional)
  - returns: `string`

## getInsertCatalogCategoryLabel

Kind: `function`
Module: `src/index.ts`
Source: `src/index.ts:1249:1`

Resolve Studio's display label for an insert-catalog category, falling back to the raw category id.
@todo Move insert-catalog presentation metadata out of `src/index.ts` into the insert domain.

### Signatures

- `(category: string) => string`
  - category: `string`
  - returns: `string`

## InsertCatalogComponentEntry

Kind: `type`
Module: `src/index.ts`
Source: `src/index.ts:337:1`

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
Source: `src/index.ts:319:1`

### Members

| Name   | Kind     | Type                              | Required | Description |
| ------ | -------- | --------------------------------- | -------- | ----------- |
| code   | property | `InsertCatalogDisabledReasonCode` | yes      |             |
| detail | property | `string`                          | yes      |             |
| issue  | property | `InsertRecipeIssue \| undefined`  | no       |             |

## InsertCatalogDisabledReasonCode

Kind: `unknown`
Module: `src/index.ts`
Source: `src/index.ts:296:1`

## InsertCatalogEntry

Kind: `unknown`
Module: `src/index.ts`
Source: `src/index.ts:347:1`

## InsertCatalogEntryBase

Kind: `type`
Module: `src/index.ts`
Source: `src/index.ts:325:1`

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
Source: `src/index.ts:293:1`

## InsertCatalogEntryStatus

Kind: `unknown`
Module: `src/index.ts`
Source: `src/index.ts:294:1`

## InsertCatalogRecipeEntry

Kind: `type`
Module: `src/index.ts`
Source: `src/index.ts:342:1`

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
Source: `src/index.ts:1026:1`

Create and insert one Studio node after validating its requested placement.
@todo Move Studio insertion orchestration from `src/index.ts` into the insert/canvas domain.

### Signatures

- `(args: InsertNodeAtPlacementArgs) => InsertNodeAtPlacementResult | null`
  - args: `InsertNodeAtPlacementArgs`
  - returns: `InsertNodeAtPlacementResult | null`

## InsertNodeAtPlacementArgs

Kind: `type`
Module: `src/index.ts`
Source: `src/index.ts:961:1`

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
Source: `src/index.ts:968:1`

### Members

| Name           | Kind     | Type     | Required | Description |
| -------------- | -------- | -------- | -------- | ----------- |
| insertedNodeId | property | `string` | yes      |             |
| root           | property | `UiNode` | yes      |             |

## InsertRecipe

Kind: `type`
Module: `src/index.ts`
Source: `src/index.ts:304:1`

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
Source: `src/index.ts:312:1`

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
Source: `src/index.ts:299:1`

### Members

| Name     | Kind     | Type                              | Required | Description |
| -------- | -------- | --------------------------------- | -------- | ----------- |
| children | property | `InsertRecipeNode[] \| undefined` | no       |             |
| type     | property | `string`                          | yes      |             |

## listStudioMediaAssets

Kind: `function`
Module: `src/mediaAuthoringModel.ts`
Source: `src/mediaAuthoringModel.ts:53:1`

List manifest media assets, optionally filter by kind, and sort them by name.
@utility @ankhorage/utility/array

### Signatures

- `(manifest: AppManifest, mediaKinds?: readonly ("file" | "image" | "audio" | "video" | "font")[] | undefined) => readonly MediaAsset[]`
  - manifest: `AppManifest`
  - mediaKinds: `readonly ("file" | "image" | "audio" | "video" | "font")[] | undefined` (optional)
  - returns: `readonly MediaAsset[]`

## moveNodeToPlacement

Kind: `function`
Module: `src/index.ts`
Source: `src/index.ts:1174:1`

Execute a validated Studio node move as immutable removal followed by insertion.
@todo Move node-move orchestration from `src/index.ts` into the canvas domain.

### Signatures

- `(args: MoveNodeToPlacementArgs) => MoveNodeToPlacementResult | null`
  - args: `MoveNodeToPlacementArgs`
  - returns: `MoveNodeToPlacementResult | null`

## MoveNodeToPlacementArgs

Kind: `type`
Module: `src/index.ts`
Source: `src/index.ts:1053:1`

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
Source: `src/index.ts:1060:1`

### Members

| Name        | Kind     | Type     | Required | Description |
| ----------- | -------- | -------- | -------- | ----------- |
| movedNodeId | property | `string` | yes      |             |
| root        | property | `UiNode` | yes      |             |

## NodePlacement

Kind: `type`
Module: `src/index.ts`
Source: `src/index.ts:254:1`

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
Source: `src/index.ts:261:1`

## PlacementFailureReason

Kind: `type`
Module: `src/index.ts`
Source: `src/index.ts:274:1`

### Members

| Name    | Kind     | Type                   | Required | Description |
| ------- | -------- | ---------------------- | -------- | ----------- |
| code    | property | `PlacementFailureCode` | yes      |             |
| message | property | `string`               | yes      |             |

## PlacementKind

Kind: `unknown`
Module: `src/index.ts`
Source: `src/index.ts:252:1`

## PlacementResolutionResult

Kind: `unknown`
Module: `src/index.ts`
Source: `src/index.ts:286:1`

## PlacementValidationResult

Kind: `unknown`
Module: `src/index.ts`
Source: `src/index.ts:279:1`

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
Source: `src/projectIdentity.ts:41:1`

Represent a failed Studio project-creation validation as an Error carrying its structured reason.

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
Source: `src/projectSecretUsage.ts:7:1`

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
Source: `src/projectSecretUsage.ts:5:1`

## ProjectSecretUsageSummary

Kind: `type`
Module: `src/projectSecretUsage.ts`
Source: `src/projectSecretUsage.ts:16:1`

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
Source: `src/mediaAuthoringModel.ts:76:1`

Parse an unknown value as an exact one-key media-reference object.
@todo Keep MediaAssetReference semantics with media/contracts; implement it from generic object/value utilities.

### Signatures

- `(value: unknown) => MediaAssetReference | null`
  - value: `unknown`
  - returns: `MediaAssetReference | null`

## removeNodeFromTree

Kind: `value`
Module: `src/index.ts`
Source: `src/index.ts:655:14`

Immutably remove a node by id from a UiNode tree and preserve unchanged branches by reference.
@utility @ankhorage/utility/tree
@todo Move the UiNode wrapper out of `src/index.ts` and parameterize tree accessors for Utility.

### Signatures

- `(root: UiNode, nodeId: string) => UiNode | null`
  - nodeId: `string`
  - root: `UiNode`
  - returns: `UiNode | null`

## removeStudioEventBinding

Kind: `function`
Module: `src/bindingMutationModel.ts`
Source: `src/bindingMutationModel.ts:65:1`

Remove one indexed event binding and delete the event entry when no bindings remain.
@todo Move binding mutation behavior under src/bindings/.

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
Source: `src/mediaAuthoringModel.ts:153:1`

Remove an unused media asset from the manifest and reject removal when the asset is missing or referenced.
@todo Move media removal policy under src/media/.

### Signatures

- `(manifest: AppManifest, mediaId: string) => StudioMediaAssetRemovalResult`
  - manifest: `AppManifest`
  - mediaId: `string`
  - returns: `StudioMediaAssetRemovalResult`

## removeStudioPropBinding

Kind: `function`
Module: `src/bindingMutationModel.ts`
Source: `src/bindingMutationModel.ts:30:1`

Remove one Studio prop binding while leaving unrelated component bindings intact.
@todo Move binding mutation behavior under src/bindings/.

### Signatures

- `(registry: Readonly<Record<string, ComponentDataBinding>>, node: UiNode, propName: string) => Readonly<Record<string, ComponentDataBinding>>`
  - node: `UiNode`
  - propName: `string`
  - registry: `Readonly<Record<string, ComponentDataBinding>>`
  - returns: `Readonly<Record<string, ComponentDataBinding>>`

## resolveDefaultInsertPlacement

Kind: `function`
Module: `src/index.ts`
Source: `src/index.ts:916:1`

Resolve the preferred insertion placement by trying the selected node, its sibling position, then the screen root.
@todo Move Studio default insertion policy from `src/index.ts` into the insert/canvas domain.

### Signatures

- `(args: { root: UiNode; selectedNodeId: string | null; childType: string; componentMeta: StudioComponentMetaRegistry; }) => PlacementResolutionResult`
  - args: `{ root: UiNode; selectedNodeId: string | null; childType: string; componentMeta: StudioComponentMetaRegistry; }`
  - returns: `PlacementResolutionResult`

## resolveInsertCatalogEntries

Kind: `function`
Module: `src/index.ts`
Source: `src/index.ts:1474:1`

Resolve enabled/disabled insert-catalog state against the active screen and selected-node placement context.
@todo Move context-sensitive insert catalog projection from `src/index.ts` into the insert/canvas application domain.

### Signatures

- `(args: { entries: readonly InsertCatalogEntry[]; root: UiNode | null; selectedNodeId: string | null; componentMeta: StudioComponentMetaRegistry; }) => InsertCatalogEntry[]`
  - args: `{ entries: readonly InsertCatalogEntry[]; root: UiNode | null; selectedNodeId: string | null; componentMeta: StudioComponentMetaRegistry; }`
  - returns: `InsertCatalogEntry[]`

## resolveInsertPlacement

Kind: `function`
Module: `src/index.ts`
Source: `src/index.ts:851:1`

Resolve a requested inside/before/after insertion target to a validated Studio placement.
@todo Move insertion-placement policy from `src/index.ts` into the `canvas/`/insert domain.

### Signatures

- `(args: { root: UiNode; targetNodeId: string; childType: string; componentMeta: StudioComponentMetaRegistry; kind: PlacementKind; }) => PlacementResolutionResult`
  - args: `{ root: UiNode; targetNodeId: string; childType: string; componentMeta: StudioComponentMetaRegistry; kind: PlacementKind; }`
  - returns: `PlacementResolutionResult`

## resolveMoveNodePlacement

Kind: `function`
Module: `src/index.ts`
Source: `src/index.ts:1102:1`

Validate and resolve a requested Studio node move after accounting for source removal and descendant/no-op invariants.
@todo Move node-move policy from `src/index.ts` into the canvas domain.

### Signatures

- `(args: MoveNodeToPlacementArgs) => PlacementResolutionResult`
  - args: `MoveNodeToPlacementArgs`
  - returns: `PlacementResolutionResult`

## resolveStudioBindableEvents

Kind: `function`
Module: `src/bindingMetadataModel.ts`
Source: `src/bindingMetadataModel.ts:29:1`

Convert a component's bindable event metadata record into labeled authoring options.
@utility @ankhorage/utility/collection

### Signatures

- `(node: UiNode, registry: Readonly<Record<string, import("@ankhorage/contracts").UiComponentMeta>>) => readonly StudioBindableEventOption[]`
  - node: `UiNode`
  - registry: `Readonly<Record<string, import("@ankhorage/contracts").UiComponentMeta>>`
  - returns: `readonly StudioBindableEventOption[]`

## resolveStudioBindableProps

Kind: `function`
Module: `src/bindingMetadataModel.ts`
Source: `src/bindingMetadataModel.ts:12:1`

Convert a component's bindable prop metadata record into labeled authoring options.
@utility @ankhorage/utility/collection

### Signatures

- `(node: UiNode, registry: Readonly<Record<string, import("@ankhorage/contracts").UiComponentMeta>>) => readonly StudioBindablePropOption[]`
  - node: `UiNode`
  - registry: `Readonly<Record<string, import("@ankhorage/contracts").UiComponentMeta>>`
  - returns: `readonly StudioBindablePropOption[]`

## resolveStudioInstancePropertyFields

Kind: `function`
Module: `src/propertiesAuthoringModel.ts`
Source: `src/propertiesAuthoringModel.ts:52:1`

Resolve instance-authorable property fields for a Studio node from component metadata and current props.
@todo Move instance-property authoring behavior under src/properties/.

### Signatures

- `(node: UiNode, registry: Readonly<Record<string, StudioAuthoringComponentMeta | undefined>>) => readonly StudioInstancePropertyField[]`
  - node: `UiNode`
  - registry: `Readonly<Record<string, StudioAuthoringComponentMeta | undefined>>`
  - returns: `readonly StudioInstancePropertyField[]`

## resolveStudioInstancePropertyGroups

Kind: `function`
Module: `src/propertiesAuthoringModel.ts`
Source: `src/propertiesAuthoringModel.ts:86:1`

Group resolved Studio instance-property fields by their authoring category.
@todo Move instance-property grouping under src/properties/.

### Signatures

- `(node: UiNode, registry: Readonly<Record<string, StudioAuthoringComponentMeta | undefined>>) => readonly StudioInstancePropertyGroup[]`
  - node: `UiNode`
  - registry: `Readonly<Record<string, StudioAuthoringComponentMeta | undefined>>`
  - returns: `readonly StudioInstancePropertyGroup[]`

## resolveStudioSchemaValueMeta

Kind: `function`
Module: `src/bindingSchemaModel.ts`
Source: `src/bindingSchemaModel.ts:18:1`

Resolve a contracts data schema into the bindable value metadata used by Studio authoring.
@todo Move binding schema interpretation under src/bindings/.

### Signatures

- `(schema: DataSchema | undefined, schemas: Readonly<Record<string, DataSchema>> | undefined, seen?: ReadonlySet<string>) => UiBindableValueMeta`
  - schema: `DataSchema | undefined`
  - schemas: `Readonly<Record<string, DataSchema>> | undefined`
  - seen: `ReadonlySet<string>` (optional)
  - returns: `UiBindableValueMeta`

## STUDIO_INSERT_RECIPES

Kind: `value`
Module: `src/index.ts`
Source: `src/index.ts:1212:14`

| id             | label          | description                              | category |
| -------------- | -------------- | ---------------------------------------- | -------- |
| screen-section | Screen section | A screen section with a starter heading. | recipe   |
| panel-stack    | Panel stack    | Panel with a stack starter.              | recipe   |
| card-heading   | Card heading   | Card with a headline.                    | recipe   |

## STUDIO_PACKAGE_BOUNDARY

Kind: `value`
Module: `src/index.ts`
Source: `src/index.ts:95:14`

## STUDIO_PACKAGE_NAME

Kind: `value`
Module: `src/index.ts`
Source: `src/index.ts:87:14`

@todo Make `src/index.ts` a public exports-only entrypoint. Package metadata, authoring contracts, tree editing, placement policy, templates and insert-catalog implementations need canonical owner modules and should only be re-exported here.

## STUDIO_PUBLIC_CONTRACTS

Kind: `value`
Module: `src/index.ts`
Source: `src/index.ts:128:14`

## StudioActionPayloadField

Kind: `type`
Module: `src/index.ts`
Source: `src/index.ts:351:1`

### Members

| Name     | Kind     | Type                           | Required | Description |
| -------- | -------- | ------------------------------ | -------- | ----------- |
| label    | property | `string`                       | yes      |             |
| required | property | `boolean \| undefined`         | no       |             |
| type     | property | `StudioActionPayloadPrimitive` | yes      |             |

## StudioActionPayloadPrimitive

Kind: `unknown`
Module: `src/index.ts`
Source: `src/index.ts:349:1`

## StudioActionPayloadSchema

Kind: `unknown`
Module: `src/index.ts`
Source: `src/index.ts:357:1`

## StudioAdminRouteId

Kind: `unknown`
Module: `src/index.ts`
Source: `src/index.ts:172:1`

## StudioAdminRoutePath

Kind: `unknown`
Module: `src/index.ts`
Source: `src/index.ts:218:1`

## StudioAdminStaticRoutePath

Kind: `unknown`
Module: `src/index.ts`
Source: `src/index.ts:198:1`

## StudioAuthoringComponentMeta

Kind: `type`
Module: `src/propertiesAuthoringModel.ts`
Source: `src/propertiesAuthoringModel.ts:16:1`

### Members

| Name  | Kind     | Type                                                  | Required | Description |
| ----- | -------- | ----------------------------------------------------- | -------- | ----------- |
| name  | property | `string`                                              | yes      |             |
| props | property | `Readonly<Record<string, StudioAuthoringPropSchema>>` | yes      |             |

## StudioAuthoringMetaRegistry

Kind: `unknown`
Module: `src/propertiesAuthoringModel.ts`
Source: `src/propertiesAuthoringModel.ts:21:1`

## StudioAuthoringPropSchema

Kind: `type`
Module: `src/propertiesAuthoringModel.ts`
Source: `src/propertiesAuthoringModel.ts:4:1`

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
| apiLabel      | property | `string`                                     | yes      |             |
| inputFields   | property | `readonly StudioBindingInputFieldOption[]`   | yes      |             |
| label         | property | `string`                                     | yes      |             |
| operation     | property | `BindingOperationRef`                        | yes      |             |
| responsePaths | property | `readonly StudioBindingResponsePathOption[]` | yes      |             |

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
Source: `src/index.ts:383:1`

## StudioComponentBlueprint

Kind: `type`
Module: `src/index.ts`
Source: `src/index.ts:367:1`

### Members

| Name         | Kind     | Type                                   | Required | Description |
| ------------ | -------- | -------------------------------------- | -------- | ----------- |
| defaultProps | property | `Record<string, unknown> \| undefined` | no       |             |
| label        | property | `string \| undefined`                  | no       |             |

## StudioComponentMeta

Kind: `type`
Module: `src/index.ts`
Source: `src/index.ts:372:1`

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
Source: `src/index.ts:379:1`

## StudioContextValue

Kind: `type`
Module: `src/index.ts`
Source: `src/index.ts:398:1`

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
| upsertMediaAsset                    | property | `(asset: MediaAsset) => void`                                                                             | yes      |             |

## StudioEvent

Kind: `unknown`
Module: `src/index.ts`
Source: `src/index.ts:391:1`

## StudioIdGenerator

Kind: `unknown`
Module: `src/index.ts`
Source: `src/index.ts:381:1`

## StudioInstancePropertyEditorKind

Kind: `unknown`
Module: `src/propertiesAuthoringModel.ts`
Source: `src/propertiesAuthoringModel.ts:25:1`

## StudioInstancePropertyField

Kind: `type`
Module: `src/propertiesAuthoringModel.ts`
Source: `src/propertiesAuthoringModel.ts:28:1`

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
Source: `src/propertiesAuthoringModel.ts:41:1`

### Members

| Name     | Kind     | Type                                     | Required | Description |
| -------- | -------- | ---------------------------------------- | -------- | ----------- |
| category | property | `string`                                 | yes      |             |
| fields   | property | `readonly StudioInstancePropertyField[]` | yes      |             |

## StudioInstancePropertyValue

Kind: `unknown`
Module: `src/propertiesAuthoringModel.ts`
Source: `src/propertiesAuthoringModel.ts:46:1`

## StudioManifest

Kind: `unknown`
Module: `src/index.ts`
Source: `src/index.ts:227:1`

## StudioMediaAssetRemovalResult

Kind: `unknown`
Module: `src/mediaAuthoringModel.ts`
Source: `src/mediaAuthoringModel.ts:17:1`

## StudioMediaDeleteResult

Kind: `unknown`
Module: `src/mediaAuthoringModel.ts`
Source: `src/mediaAuthoringModel.ts:25:1`

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
| body        | property | `Uint8Array<ArrayBufferLike>`                       | yes      |             |
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
Source: `src/mediaAuthoringModel.ts:11:1`

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
Source: `src/index.ts:168:1`

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
Source: `src/index.ts:166:1`

## StudioPackageBoundary

Kind: `type`
Module: `src/index.ts`
Source: `src/index.ts:89:1`

### Members

| Name       | Kind     | Type                | Required | Description |
| ---------- | -------- | ------------------- | -------- | ----------- |
| consumes   | property | `readonly string[]` | yes      |             |
| doesNotOwn | property | `readonly string[]` | yes      |             |
| owns       | property | `readonly string[]` | yes      |             |

## StudioPanelId

Kind: `unknown`
Module: `src/index.ts`
Source: `src/index.ts:171:1`

## StudioProjectId

Kind: `unknown`
Module: `src/index.ts`
Source: `src/index.ts:164:1`

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
Source: `src/index.ts:162:1`

## StudioSaveStatus

Kind: `unknown`
Module: `src/index.ts`
Source: `src/index.ts:170:1`

## StudioScreenId

Kind: `unknown`
Module: `src/index.ts`
Source: `src/index.ts:167:1`

## StudioSelectionState

Kind: `type`
Module: `src/index.ts`
Source: `src/index.ts:234:1`

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
Source: `src/index.ts:165:1`

## StudioSessionState

Kind: `type`
Module: `src/index.ts`
Source: `src/index.ts:242:1`

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
Source: `src/mediaAuthoringModel.ts:45:1`

## TemplateCatalog

Kind: `type`
Module: `src/templateCatalogContracts.ts`
Source: `src/templateCatalogContracts.ts:20:1`

### Members

| Name       | Kind     | Type                        | Required | Description |
| ---------- | -------- | --------------------------- | -------- | ----------- |
| categories | property | `TemplateCatalogCategory[]` | yes      |             |

## TemplateCatalogCategory

Kind: `type`
Module: `src/templateCatalogContracts.ts`
Source: `src/templateCatalogContracts.ts:9:1`

### Members

| Name          | Kind     | Type                                                                                                                                                                                                                                                                                                                                                                                                                                          | Required | Description |
| ------------- | -------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------- | ----------- |
| focusAreas    | property | `readonly string[]`                                                                                                                                                                                                                                                                                                                                                                                                                           | yes      |             |
| harmony       | property | `"monochromatic" \| "analogous" \| "complementary" \| "splitComplementary" \| "triadic" \| "tetradic" \| "square"`                                                                                                                                                                                                                                                                                                                            | yes      |             |
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

| Name | Kind     | Type     | Required | Description |
| ---- | -------- | -------- | -------- | ----------- |
| id   | property | `string` | yes      |             |
| name | property | `string` | yes      |             |
| slug | property | `string` | yes      |             |

## TemplateEntry

Kind: `unknown`
Module: `src/templateCatalogContracts.ts`
Source: `src/templateCatalogContracts.ts:24:1`

## ThemeUpdates

Kind: `unknown`
Module: `src/index.ts`
Source: `src/index.ts:229:1`

## TPL_SCREEN_EMPTY

Kind: `value`
Module: `src/index.ts`
Source: `src/index.ts:537:14`

## updateNodeInTree

Kind: `value`
Module: `src/index.ts`
Source: `src/index.ts:627:14`

Immutably update one UiNode by id while preserving Studio's alias/style versus props patch semantics.
@utility @ankhorage/utility/tree
@todo Keep Studio-specific patch projection in the canvas/properties owner and extract the generic immutable tree-update primitive to Utility.

### Signatures

- `(root: UiNode, id: string, newProps: Record<string, unknown>) => UiNode`
  - id: `string`
  - newProps: `Record<string, unknown>`
  - root: `UiNode`
  - returns: `UiNode`

## upsertStudioMediaAsset

Kind: `function`
Module: `src/mediaAuthoringModel.ts`
Source: `src/mediaAuthoringModel.ts:128:1`

Immutably insert or replace a keyed media asset in a manifest registry.
@utility @ankhorage/utility/object

### Signatures

- `(manifest: AppManifest, asset: MediaAsset) => AppManifest`
  - asset: `MediaAsset`
  - manifest: `AppManifest`
  - returns: `AppManifest`

## upsertStudioPropBinding

Kind: `function`
Module: `src/bindingMutationModel.ts`
Source: `src/bindingMutationModel.ts:14:1`

Add or replace one Studio prop binding for a component node.
@todo Move binding mutation behavior under src/bindings/.

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
Source: `src/index.ts:1272:1`

Validate an insert recipe recursively against Studio component metadata and allowed-child constraints.
@todo Move recipe validation from `src/index.ts` into the insert/templates domain.

### Signatures

- `(recipe: InsertRecipe, componentMeta: StudioComponentMetaRegistry) => InsertRecipeIssue | null`
  - componentMeta: `StudioComponentMetaRegistry`
  - recipe: `InsertRecipe`
  - returns: `InsertRecipeIssue | null`

## validateNodePlacement

Kind: `function`
Module: `src/index.ts`
Source: `src/index.ts:760:1`

Validate one resolved Studio placement against parent existence, child policy, index bounds and sibling-reference invariants.
@todo Move placement validation from the public entrypoint into the `canvas/` domain.

### Signatures

- `(args: { root: UiNode; placement: NodePlacement; childType: string; componentMeta: StudioComponentMetaRegistry; }) => PlacementValidationResult`
  - args: `{ root: UiNode; placement: NodePlacement; childType: string; componentMeta: StudioComponentMetaRegistry; }`
  - returns: `PlacementValidationResult`

## validateProjectCreationInput

Kind: `function`
Module: `src/projectIdentity.ts`
Source: `src/projectIdentity.ts:53:1`

Validate a new Studio project name and derived id against format, reservation, and uniqueness rules.
@todo Move project creation validation under src/projects/.

### Signatures

- `(args: { name: string; existingProjects: readonly StudioProjectSummary[]; }) => ProjectCreationValidationResult`
  - args: `{ name: string; existingProjects: readonly StudioProjectSummary[]; }`
  - returns: `ProjectCreationValidationResult`
