import type { ZoraThemeRecipeMeta, ZoraThemeTokenFamily } from '@ankhorage/zora/metadata';

import type {
  AuthoringPresentationPolicy,
  AuthoringStructure,
} from '../../../../types/authoring-engine';

/*** Adapt released ZORA recipe metadata and runtime token choices into neutral structure and inheritance policy. */
export function resolveZoraThemeRecipeAuthoring(
  meta: ZoraThemeRecipeMeta,
  resolveTokens: (family: ZoraThemeTokenFamily) => readonly string[],
): { readonly structure: AuthoringStructure; readonly policy: AuthoringPresentationPolicy } {
  return {
    structure: {
      kind: 'object',
      fields: Object.entries(meta.fields).map(([name, field]) => ({
        name,
        optional: true,
        structure:
          field.type === 'boolean'
            ? { kind: 'scalar', scalarType: 'boolean' }
            : {
                kind: 'choice',
                values: field.type === 'choice' ? field.options : resolveTokens(field.tokenFamily),
              },
      })),
    },
    policy: {
      label: meta.name,
      description: meta.description,
      fields: Object.fromEntries(
        Object.entries(meta.fields).map(([name, field]) => [
          name,
          {
            label: field.label,
            description: field.description,
            inheritance: { value: field.default },
          },
        ]),
      ),
    },
  };
}
