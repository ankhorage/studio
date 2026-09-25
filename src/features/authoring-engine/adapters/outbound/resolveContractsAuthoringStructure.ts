import type {
  StructureDescriptor,
  StructureDescriptorDocument,
  StructureReferenceDescriptor,
} from '@ankhorage/contracts/structure';

import type {
  AuthoringStructure,
  AuthoringStructureResolution,
} from '../../../../types/authoring-engine';

/*** Resolve one named Contracts structure root into Studio's neutral authoring structure. */
export function resolveContractsAuthoringStructure(
  document: StructureDescriptorDocument,
  rootName: string,
): AuthoringStructureResolution {
  const rootId = Object.entries(document.roots).find(([name]) => name === rootName)?.[1];
  if (!rootId) {
    return {
      ok: false,
      diagnostic: {
        code: 'unresolved-reference',
        message: `Structure root "${rootName}" is not published by ${document.packageName}.`,
        path: [],
      },
    };
  }

  const definition = Object.entries(document.descriptors).find(([id]) => id === rootId)?.[1];
  if (!definition) {
    return {
      ok: false,
      diagnostic: {
        code: 'unresolved-reference',
        message: `Structure root "${rootName}" resolves to missing descriptor "${rootId}".`,
        path: [],
      },
    };
  }

  return {
    ok: true,
    structure: resolveDescriptor(definition.descriptor, document, new Set([rootId]), []),
  };
}

/*** Translate one portable descriptor into the current neutral authoring structure vocabulary. */
function resolveDescriptor(
  descriptor: StructureDescriptor,
  document: StructureDescriptorDocument,
  visited: ReadonlySet<string>,
  path: readonly string[],
): AuthoringStructure {
  switch (descriptor.kind) {
    case 'scalar':
      return { kind: 'scalar', scalarType: descriptor.type };
    case 'enum':
      return { kind: 'choice', values: descriptor.values };
    case 'object':
      return {
        kind: 'object',
        fields: Object.entries(descriptor.fields)
          .sort(([left], [right]) => left.localeCompare(right))
          .map(([name, field]) => ({
            name,
            optional: field.optional === true,
            structure: resolveDescriptor(field.value, document, visited, [...path, name]),
          })),
      };
    case 'set':
      return {
        kind: 'set',
        member: resolveDescriptor(descriptor.member, document, visited, [...path, '*']),
      };
    case 'ordered-list':
      return {
        kind: 'ordered-list',
        item: resolveDescriptor(descriptor.item, document, visited, [...path, '*']),
      };
    case 'value-map':
      return {
        kind: 'value-map',
        key: resolveDescriptor(descriptor.key, document, visited, [...path, '<key>']),
        value: resolveDescriptor(descriptor.value, document, visited, [...path, '*']),
      };
    case 'entity-registry':
      return {
        kind: 'entity-registry',
        key: resolveDescriptor(descriptor.key, document, visited, [...path, '<key>']),
        value: resolveDescriptor(descriptor.value, document, visited, [...path, '*']),
        ...(descriptor.identityField === undefined
          ? {}
          : { identityField: descriptor.identityField }),
      };
    case 'union':
      return {
        kind: 'union',
        variants: descriptor.variants.map((variant, index) =>
          resolveDescriptor(variant, document, visited, [...path, `<variant:${index}>`]),
        ),
        ...(descriptor.discriminator === undefined
          ? {}
          : { discriminator: descriptor.discriminator }),
      };
    case 'ref':
      return resolveReference(descriptor, document, visited, path);
  }
}

/*** Resolve one local descriptor reference and reject unsupported external/cyclic references explicitly. */
function resolveReference(
  descriptor: StructureReferenceDescriptor,
  document: StructureDescriptorDocument,
  visited: ReadonlySet<string>,
  path: readonly string[],
): AuthoringStructure {
  if (descriptor.packageName && descriptor.packageName !== document.packageName) {
    return {
      kind: 'unsupported',
      sourceKind: 'external-ref',
      diagnostic: {
        code: 'unresolved-reference',
        message: `External structure reference ${descriptor.packageName}#${descriptor.id} is not loaded.`,
        path,
      },
    };
  }

  if (visited.has(descriptor.id)) {
    return {
      kind: 'unsupported',
      sourceKind: 'recursive-ref',
      diagnostic: {
        code: 'unresolved-reference',
        message: `Recursive structure reference "${descriptor.id}" requires a recursive authoring adapter.`,
        path,
      },
    };
  }

  const definition = Object.entries(document.descriptors).find(([id]) => id === descriptor.id)?.[1];
  if (!definition) {
    return {
      kind: 'unsupported',
      sourceKind: 'missing-ref',
      diagnostic: {
        code: 'unresolved-reference',
        message: `Structure reference "${descriptor.id}" is missing from ${document.packageName}.`,
        path,
      },
    };
  }

  return resolveDescriptor(
    definition.descriptor,
    document,
    new Set([...visited, descriptor.id]),
    path,
  );
}
