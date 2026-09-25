import type { AuthoringCollectionKey } from '../../../types/authoring-engine';

/*** Check one concrete string key against resolved owner collection-key semantics. */
export function isAuthoringCollectionKeyAllowed(
  key: AuthoringCollectionKey,
  candidate: string,
): boolean {
  if (candidate.trim().length === 0) return false;
  return key.kind === 'scalar' || key.values.includes(candidate);
}
