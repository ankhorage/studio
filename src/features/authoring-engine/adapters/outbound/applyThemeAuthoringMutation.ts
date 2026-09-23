import type { ThemeConfig } from '@ankhorage/contracts';
import { STRUCTURE_DESCRIPTOR } from '@ankhorage/contracts/structure';

import type {
  AuthoringMutation,
  AuthoringMutationResult,
} from '../../../../types/authoring-engine';
import { applyAuthoringMutationToStructure } from '../../application/use-cases/applyAuthoringMutationToStructure';
import { resolveContractsAuthoringStructure } from './resolveContractsAuthoringStructure';

/*** Apply one Theme authoring mutation through the released owner structure and preserve canonical ThemeConfig state. */
export function applyThemeAuthoringMutation(
  theme: ThemeConfig,
  mutation: AuthoringMutation,
): AuthoringMutationResult<ThemeConfig> {
  const resolution = resolveContractsAuthoringStructure(STRUCTURE_DESCRIPTOR, 'theme-config');
  if (!resolution.ok) return { ok: false, diagnostic: resolution.diagnostic };
  return applyAuthoringMutationToStructure(theme, resolution.structure, mutation);
}
