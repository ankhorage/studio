import type { BindingValue } from '@ankhorage/contracts';

import { AuthoringEditor } from '../../../../features/authoring-engine/adapters/inbound/AuthoringEditor';
import { applyAuthoringMutation } from '../../../../features/authoring-engine/application/use-cases/applyAuthoringMutation';
import { deriveAuthoringModel } from '../../../../features/authoring-engine/application/use-cases/deriveAuthoringModel';
import type { AuthoringStructure } from '../../../../types/authoring-engine';

interface BindingLiteralState {
  readonly value?: BindingValue;
}

/*** Render one DataSchema-backed binding literal through the shared neutral Authoring Engine and emit typed canonical values. */
export function BindingLiteralAuthoringEditor(props: {
  readonly label: string;
  readonly required: boolean;
  readonly structure: AuthoringStructure;
  readonly value: BindingValue | undefined;
  readonly onChange: (value: BindingValue | undefined) => void;
}) {
  const structure: AuthoringStructure = {
    kind: 'object',
    fields: [{ name: 'value', optional: !props.required, structure: props.structure }],
  };
  const state: BindingLiteralState = props.value === undefined ? {} : { value: props.value };
  const model = deriveAuthoringModel({
    structure,
    value: state,
    policy: { fields: { value: { label: props.label } } },
  });

  return (
    <AuthoringEditor
      model={model}
      onMutation={(mutation) => {
        const result = applyAuthoringMutation(state, mutation);
        if (result.ok) props.onChange(result.value.value);
      }}
    />
  );
}
