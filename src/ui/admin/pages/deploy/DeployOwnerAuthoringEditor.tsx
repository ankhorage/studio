import { Text } from '@ankhorage/zora';
import React from 'react';

import { AuthoringEditor } from '../../../../features/authoring-engine/adapters/inbound/AuthoringEditor';
import { applyAuthoringMutationToStructure } from '../../../../features/authoring-engine/application/use-cases/applyAuthoringMutationToStructure';
import { deriveAuthoringModel } from '../../../../features/authoring-engine/application/use-cases/deriveAuthoringModel';
import type {
  AuthoringPresentationPolicy,
  AuthoringStructureResolution,
} from '../../../../types/authoring-engine';

export interface DeployOwnerAuthoringEditorProps<T> {
  readonly structure: AuthoringStructureResolution;
  readonly value: T;
  readonly policy?: AuthoringPresentationPolicy;
  readonly onChange: (value: T) => void;
  readonly onError: (message: string | null) => void;
}

/*** Render one Deploy-owned structure through the neutral Authoring Engine and apply immutable typed mutations. */
export function DeployOwnerAuthoringEditor<T>(props: DeployOwnerAuthoringEditorProps<T>) {
  if (!props.structure.ok) {
    return <Text color="danger">{props.structure.diagnostic.message}</Text>;
  }
  const { structure } = props.structure;

  return (
    <AuthoringEditor
      model={deriveAuthoringModel({
        structure,
        value: props.value,
        policy: props.policy,
      })}
      onMutation={(mutation) => {
        const result = applyAuthoringMutationToStructure(props.value, structure, mutation);
        if (!result.ok) {
          props.onError(result.diagnostic.message);
          return;
        }
        props.onError(null);
        props.onChange(result.value);
      }}
    />
  );
}
