import type {
  StructureDescriptor,
  StructureDescriptorDocument,
  StructureLiteralValue,
} from '@ankhorage/contracts/structure';
import { isRecord, readOwnProperty } from '@ankhorage/utility/object';

import type {
  StudioAuthoringDiagnostic,
  StudioAuthoringFieldMetadata,
  StudioAuthoringMetadataRegistry,
  StudioAuthoringModel,
  StudioAuthoringNode,
  StudioAuthoringPath,
} from './authoringTypes';

/*** Derive one UI-framework-neutral authoring model from canonical structure evidence and owner metadata. */
export function deriveStudioAuthoringModel(args: {
  readonly document: StructureDescriptorDocument;
  readonly rootName: string;
  readonly value: unknown;
  readonly metadata?: StudioAuthoringMetadataRegistry;
}): StudioAuthoringModel {
  const rootId = readOwnProperty(args.document.roots, args.rootName);
  const definition =
    typeof rootId === 'string' ? readOwnProperty(args.document.descriptors, rootId) : undefined;
  if (!definition) {
    const diagnostic = createDiagnostic(
      'unresolved-reference',
      [],
      `Structure root "${args.rootName}" is not available.`,
    );
    return {
      root: createUnsupportedNode(args.rootName, [], false, false, diagnostic),
      diagnostics: [diagnostic],
    };
  }

  const diagnostics: StudioAuthoringDiagnostic[] = [];
  const root = deriveNode({
    descriptor: definition.descriptor,
    document: args.document,
    value: args.value,
    path: [],
    label: resolveLabel(args.rootName, resolveMetadata(args.metadata, [])),
    optional: false,
    metadata: args.metadata,
    diagnostics,
    visitedRefs: new Set([definition.id]),
  });
  return { root, diagnostics };
}

interface DeriveNodeArgs {
  readonly descriptor: StructureDescriptor;
  readonly document: StructureDescriptorDocument;
  readonly value: unknown;
  readonly path: StudioAuthoringPath;
  readonly label: string;
  readonly optional: boolean;
  readonly metadata: StudioAuthoringMetadataRegistry | undefined;
  readonly diagnostics: StudioAuthoringDiagnostic[];
  readonly visitedRefs: ReadonlySet<string>;
}

/*** Project one structural descriptor node into the neutral authoring vocabulary. */
function deriveNode(args: DeriveNodeArgs): StudioAuthoringNode {
  const fieldMetadata = resolveMetadata(args.metadata, args.path);
  const base = {
    id: toPathKey(args.path) || 'root',
    path: args.path,
    label: resolveLabel(args.label, fieldMetadata),
    ...(fieldMetadata?.description ? { description: fieldMetadata.description } : {}),
    optional: args.optional,
    readOnly: fieldMetadata?.readOnly === true,
  };

  if (args.descriptor.kind === 'ref') return deriveReference(args);
  if (args.descriptor.kind === 'object') {
    const record = isRecord(args.value) ? args.value : undefined;
    if (args.value !== undefined && !record) {
      return unsupported(
        args,
        'invalid-value',
        `Expected an object value at "${displayPath(args.path)}".`,
      );
    }

    const fields = Object.entries(args.descriptor.fields).flatMap(([name, field]) => {
      const childPath = [...args.path, name];
      const metadata = resolveMetadata(args.metadata, childPath);
      if (metadata?.hidden === true) return [];
      return [
        deriveNode({
          ...args,
          descriptor: field.value,
          value: record ? readOwnProperty(record, name) : undefined,
          path: childPath,
          label: name,
          optional: field.optional === true,
        }),
      ];
    });
    return { ...base, kind: 'object', fields };
  }

  if (args.descriptor.kind === 'scalar') {
    if (args.descriptor.type === 'string') {
      return {
        ...base,
        kind: 'text',
        value: typeof args.value === 'string' ? args.value : undefined,
        multiline: fieldMetadata?.multiline === true,
      };
    }
    if (args.descriptor.type === 'number' || args.descriptor.type === 'integer') {
      return {
        ...base,
        kind: 'number',
        value: typeof args.value === 'number' ? args.value : undefined,
      };
    }
    if (args.descriptor.type === 'boolean') {
      return {
        ...base,
        kind: 'boolean',
        value: typeof args.value === 'boolean' ? args.value : undefined,
      };
    }
    return unsupported(args, 'unsupported-structure', 'Null-only fields are not authorable.');
  }

  if (args.descriptor.kind === 'enum') {
    if (isBooleanChoice(args.descriptor.values)) {
      return {
        ...base,
        kind: 'boolean',
        value: typeof args.value === 'boolean' ? args.value : undefined,
      };
    }
    const value = isLiteralValue(args.value) ? args.value : undefined;
    return { ...base, kind: 'choice', value, options: args.descriptor.values };
  }

  return unsupported(
    args,
    'unsupported-structure',
    `Structural kind "${args.descriptor.kind}" is not supported by this authoring slice.`,
  );
}

/*** Resolve a local structure reference while diagnosing external, missing, or recursive references explicitly. */
function deriveReference(args: DeriveNodeArgs): StudioAuthoringNode {
  if (args.descriptor.kind !== 'ref') return deriveNode(args);
  if (args.descriptor.packageName && args.descriptor.packageName !== args.document.packageName) {
    return unsupported(
      args,
      'unresolved-reference',
      `External structure "${args.descriptor.packageName}:${args.descriptor.id}" is not loaded.`,
    );
  }
  if (args.visitedRefs.has(args.descriptor.id)) {
    return unsupported(
      args,
      'unsupported-structure',
      `Recursive structure reference "${args.descriptor.id}" cannot be rendered inline.`,
    );
  }

  const definition = readOwnProperty(args.document.descriptors, args.descriptor.id);
  if (!definition) {
    return unsupported(
      args,
      'unresolved-reference',
      `Structure reference "${args.descriptor.id}" is missing.`,
    );
  }
  const visitedRefs = new Set(args.visitedRefs);
  visitedRefs.add(args.descriptor.id);
  return deriveNode({ ...args, descriptor: definition.descriptor, visitedRefs });
}

/*** Build an unsupported authoring node and append its diagnostic to the model result. */
function unsupported(
  args: DeriveNodeArgs,
  code: StudioAuthoringDiagnostic['code'],
  message: string,
): StudioAuthoringNode {
  const diagnostic = createDiagnostic(code, args.path, message);
  args.diagnostics.push(diagnostic);
  const metadata = resolveMetadata(args.metadata, args.path);
  return createUnsupportedNode(
    resolveLabel(args.label, metadata),
    args.path,
    args.optional,
    metadata?.readOnly === true,
    diagnostic,
  );
}

/*** Create one diagnostic with immutable path evidence. */
function createDiagnostic(
  code: StudioAuthoringDiagnostic['code'],
  path: StudioAuthoringPath,
  message: string,
): StudioAuthoringDiagnostic {
  return { code, path: [...path], message };
}

/*** Construct the neutral unsupported node shared by derivation failure paths. */
function createUnsupportedNode(
  label: string,
  path: StudioAuthoringPath,
  optional: boolean,
  readOnly: boolean,
  diagnostic: StudioAuthoringDiagnostic,
): StudioAuthoringNode {
  return {
    id: toPathKey(path) || 'root',
    path: [...path],
    label,
    optional,
    readOnly,
    kind: 'unsupported',
    diagnostic,
  };
}

/*** Resolve optional owner authoring metadata by canonical dotted structural path. */
function resolveMetadata(
  registry: StudioAuthoringMetadataRegistry | undefined,
  path: StudioAuthoringPath,
): StudioAuthoringFieldMetadata | undefined {
  if (!registry) return undefined;
  return readOwnProperty(registry, toPathKey(path));
}

/*** Resolve an explicit authoring label or humanize the structural field name. */
function resolveLabel(name: string, metadata: StudioAuthoringFieldMetadata | undefined): string {
  if (metadata?.label) return metadata.label;
  return name
    .replace(/([a-z0-9])([A-Z])/gu, '$1 $2')
    .replaceAll('-', ' ')
    .replace(/^./u, (character) => character.toUpperCase());
}

/*** Convert a structural path into the stable metadata/model key used by the authoring engine. */
function toPathKey(path: StudioAuthoringPath): string {
  return path.join('.');
}

/*** Render a structural path for actionable diagnostics. */
function displayPath(path: StudioAuthoringPath): string {
  return path.length === 0 ? 'root' : toPathKey(path);
}

/*** Narrow arbitrary runtime values to the portable scalar literal vocabulary. */
function isLiteralValue(value: unknown): value is StructureLiteralValue {
  return (
    value === null ||
    typeof value === 'boolean' ||
    (typeof value === 'number' && Number.isFinite(value)) ||
    typeof value === 'string'
  );
}

/*** Recognize the finite boolean union emitted by TypeScript for authored booleans. */
function isBooleanChoice(values: readonly StructureLiteralValue[]): boolean {
  return (
    values.length === 2 &&
    values.every((value) => typeof value === 'boolean') &&
    values.includes(false) &&
    values.includes(true)
  );
}
