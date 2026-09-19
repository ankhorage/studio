import type { StructureLiteralValue } from '@ankhorage/contracts/structure';

export type StudioAuthoringPath = readonly string[];

export type StudioAuthoringDiagnosticCode =
  | 'invalid-value'
  | 'read-only'
  | 'required-value'
  | 'unresolved-reference'
  | 'unsupported-structure';

export interface StudioAuthoringDiagnostic {
  readonly code: StudioAuthoringDiagnosticCode;
  readonly path: StudioAuthoringPath;
  readonly message: string;
}

export interface StudioAuthoringFieldMetadata {
  readonly label?: string;
  readonly description?: string;
  readonly readOnly?: boolean;
  readonly multiline?: boolean;
  readonly hidden?: boolean;
}

export type StudioAuthoringMetadataRegistry = Readonly<
  Record<string, StudioAuthoringFieldMetadata | undefined>
>;

interface StudioAuthoringNodeBase {
  readonly id: string;
  readonly path: StudioAuthoringPath;
  readonly label: string;
  readonly description?: string;
  readonly optional: boolean;
  readonly readOnly: boolean;
}

export interface StudioAuthoringObjectNode extends StudioAuthoringNodeBase {
  readonly kind: 'object';
  readonly fields: readonly StudioAuthoringNode[];
}

export interface StudioAuthoringTextField extends StudioAuthoringNodeBase {
  readonly kind: 'text';
  readonly value: string | undefined;
  readonly multiline: boolean;
}

export interface StudioAuthoringNumberField extends StudioAuthoringNodeBase {
  readonly kind: 'number';
  readonly value: number | undefined;
}

export interface StudioAuthoringBooleanField extends StudioAuthoringNodeBase {
  readonly kind: 'boolean';
  readonly value: boolean | undefined;
}

export interface StudioAuthoringChoiceField extends StudioAuthoringNodeBase {
  readonly kind: 'choice';
  readonly value: StructureLiteralValue | undefined;
  readonly options: readonly StructureLiteralValue[];
}

export interface StudioAuthoringUnsupportedNode extends StudioAuthoringNodeBase {
  readonly kind: 'unsupported';
  readonly diagnostic: StudioAuthoringDiagnostic;
}

export type StudioAuthoringNode =
  | StudioAuthoringBooleanField
  | StudioAuthoringChoiceField
  | StudioAuthoringNumberField
  | StudioAuthoringObjectNode
  | StudioAuthoringTextField
  | StudioAuthoringUnsupportedNode;

export type StudioAuthoringField = Exclude<
  StudioAuthoringNode,
  StudioAuthoringObjectNode | StudioAuthoringUnsupportedNode
>;

export interface StudioAuthoringModel {
  readonly root: StudioAuthoringNode;
  readonly diagnostics: readonly StudioAuthoringDiagnostic[];
}

export type StudioAuthoringMutationResult<TValue> =
  | {
      readonly ok: true;
      readonly value: TValue;
    }
  | {
      readonly ok: false;
      readonly diagnostic: StudioAuthoringDiagnostic;
    };
