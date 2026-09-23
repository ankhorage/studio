import type { AuthoringStructure, AuthoringValue } from '../../../../types/authoring-engine';

/*** Create one deterministic structurally valid initial value for generic collection insertion. */
export function createInitialAuthoringValue(
  structure: AuthoringStructure,
): AuthoringValue | undefined {
  switch (structure.kind) {
    case 'scalar':
      if (structure.scalarType === 'boolean') return false;
      if (structure.scalarType === 'null') return null;
      if (structure.scalarType === 'string') return '';
      return 0;
    case 'choice':
      return structure.values.at(0);
    case 'set':
      return {};
    case 'ordered-list':
      return [];
    case 'value-map':
      return {};
    case 'object': {
      const entries = structure.fields
        .filter((field) => !field.optional)
        .map((field) => [field.name, createInitialAuthoringValue(field.structure)] as const);
      if (entries.some(([, value]) => value === undefined)) return undefined;
      return Object.fromEntries(entries) as Readonly<Record<string, AuthoringValue>>;
    }
    case 'unsupported':
      return undefined;
  }
}
