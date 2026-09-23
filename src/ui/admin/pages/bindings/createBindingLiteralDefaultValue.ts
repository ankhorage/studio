import type { BindingValue, UiBindableValueMeta } from '@ankhorage/contracts';

import type { StudioBindingInputFieldOption } from '../../../../bindingAuthoringModel';
import type { AuthoringStructure } from '../../../../types/authoring-engine';

/*** Create a deterministic typed literal value for one binding input from neutral authoring semantics, falling back to bindable metadata. */
export function createBindingLiteralDefaultValue(
  field: Pick<StudioBindingInputFieldOption, 'authoring' | 'value'>,
): BindingValue {
  const authoredDefault = field.authoring
    ? createDefaultAuthoringValue(field.authoring)
    : undefined;
  return authoredDefault !== undefined
    ? authoredDefault
    : createBindableMetaDefaultValue(field.value);
}

/*** Build the minimum value needed to render required neutral authoring nodes without guessing unsupported structures. */
function createDefaultAuthoringValue(structure: AuthoringStructure): BindingValue | undefined {
  switch (structure.kind) {
    case 'choice':
      return structure.values[0];
    case 'object':
      return Object.fromEntries(
        structure.fields.flatMap((field) => {
          if (field.optional) return [];
          const value = createDefaultAuthoringValue(field.structure);
          return value === undefined ? [] : [[field.name, value]];
        }),
      );
    case 'ordered-list':
      return [];
    case 'scalar':
      return createDefaultScalarValue(structure.scalarType);
    case 'set':
      return {};
    case 'unsupported':
      return undefined;
  }
}

/*** Build the deterministic empty value for one supported neutral scalar type. */
function createDefaultScalarValue(
  scalarType: Extract<AuthoringStructure, { readonly kind: 'scalar' }>['scalarType'],
): BindingValue {
  if (scalarType === 'boolean') return false;
  if (scalarType === 'integer' || scalarType === 'number') return 0;
  if (scalarType === 'null') return null;
  return '';
}

/*** Preserve the existing binding defaults for non-DataSchema action inputs and unsupported neutral structures. */
function createBindableMetaDefaultValue(meta: UiBindableValueMeta): BindingValue {
  if (meta.type === 'boolean') return false;
  if (meta.type === 'number') return 0;
  if (meta.type === 'array') return [];
  if (meta.type === 'object' || meta.type === 'record' || meta.type === 'imageAsset') return {};
  return '';
}
