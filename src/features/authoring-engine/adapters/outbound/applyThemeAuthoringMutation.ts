import type { ThemeConfig } from '@ankhorage/contracts';
import { STRUCTURE_DESCRIPTOR } from '@ankhorage/contracts/structure';

import type { ThemeUpdates } from '../../../../index';
import type {
  AuthoringMutation,
  AuthoringMutationResult,
} from '../../../../types/authoring-engine';
import { applyAuthoringMutationToStructure } from '../../application/use-cases/applyAuthoringMutationToStructure';
import { resolveContractsAuthoringStructure } from './resolveContractsAuthoringStructure';

/*** Apply one Theme authoring mutation through owner structure and project the result onto Studio's canonical updateTheme boundary. */
export function applyThemeAuthoringMutation(
  theme: ThemeConfig,
  mutation: AuthoringMutation,
): AuthoringMutationResult<ThemeUpdates> {
  const resolution = resolveContractsAuthoringStructure(STRUCTURE_DESCRIPTOR, 'theme-config');
  if (!resolution.ok) return { ok: false, diagnostic: resolution.diagnostic };

  const applied = applyAuthoringMutationToStructure(theme, resolution.structure, mutation);
  if (!applied.ok) return applied;
  return projectThemeUpdate(applied.value, mutation);
}

/*** Project only the globally authored Theme branch touched by one neutral mutation. */
function projectThemeUpdate(
  theme: ThemeConfig,
  mutation: AuthoringMutation,
): AuthoringMutationResult<ThemeUpdates> {
  const [root] = mutation.path;
  switch (root) {
    case 'name':
      return { ok: true, value: { name: theme.name } };
    case 'light':
      return { ok: true, value: { light: theme.light } };
    case 'dark':
      return { ok: true, value: { dark: theme.dark } };
    case 'tokens':
      return { ok: true, value: { tokens: theme.tokens } };
    default:
      return {
        ok: false,
        diagnostic: {
          code: 'mutation-rejected',
          message: `Theme path "${root ?? '<root>'}" is not exposed by global Theme authoring.`,
          path: mutation.path,
        },
      };
  }
}
