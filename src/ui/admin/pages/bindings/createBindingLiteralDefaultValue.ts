import type { BindingValue, UiBindableValueMeta } from '@ankhorage/contracts';

import type { StudioBindingInputFieldOption } from '../../../../bindingAuthoringModel';
import { createInitialAuthoringValue } from '../../../../features/authoring-engine/application/use-cases/createInitialAuthoringValue';

/*** Create a deterministic typed literal value for one binding input from neutral authoring semantics, falling back to bindable metadata. */
export function createBindingLiteralDefaultValue(
  field: Pick<StudioBindingInputFieldOption, 'authoring' | 'value'>,
): BindingValue {
  const authoredDefault = field.authoring
    ? createInitialAuthoringValue(field.authoring)
    : undefined;
  return authoredDefault !== undefined
    ? authoredDefault
    : createBindableMetaDefaultValue(field.value);
}

/*** Preserve binding defaults for non-DataSchema action inputs and unsupported neutral structures. */
function createBindableMetaDefaultValue(meta: UiBindableValueMeta): BindingValue {
  if (meta.type === 'boolean') return false;
  if (meta.type === 'number') return 0;
  if (meta.type === 'array') return [];
  if (meta.type === 'object' || meta.type === 'record' || meta.type === 'imageAsset') return {};
  return '';
}
