import type { AuthoringCollectionKey, AuthoringStructure } from '../../../types/authoring-engine';

/*** Resolve the supported string-key semantics shared by maps and entity registries. */
export function resolveAuthoringCollectionKey(
  structure: AuthoringStructure,
): AuthoringCollectionKey | undefined {
  if (structure.kind === 'scalar' && structure.scalarType === 'string') {
    return { kind: 'scalar', scalarType: 'string' };
  }
  if (structure.kind !== 'choice') return undefined;

  const values = structure.values.filter(
    (candidate): candidate is string => typeof candidate === 'string',
  );
  return values.length === structure.values.length ? { kind: 'choice', values } : undefined;
}
