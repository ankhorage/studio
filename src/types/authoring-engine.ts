export type AuthoringScalarType = 'boolean' | 'integer' | 'null' | 'number' | 'string';

export type AuthoringPrimitive = boolean | number | string | null;

export interface AuthoringDiagnostic {
  readonly code:
    'invalid-value' | 'mutation-rejected' | 'unresolved-reference' | 'unsupported-structure';
  readonly message: string;
  readonly path: readonly string[];
}

export interface AuthoringPresentationPolicy {
  readonly label?: string;
  readonly description?: string;
  readonly readOnly?: boolean;
  readonly multiline?: boolean;
  readonly fields?: Readonly<Record<string, AuthoringPresentationPolicy>>;
}

interface AuthoringStructureField {
  readonly name: string;
  readonly optional: boolean;
  readonly structure: AuthoringStructure;
}

export type AuthoringStructure =
  | {
      readonly kind: 'scalar';
      readonly scalarType: AuthoringScalarType;
    }
  | {
      readonly kind: 'choice';
      readonly values: readonly AuthoringPrimitive[];
    }
  | {
      readonly kind: 'object';
      readonly fields: readonly AuthoringStructureField[];
    }
  | {
      readonly kind: 'unsupported';
      readonly sourceKind: string;
      readonly diagnostic: AuthoringDiagnostic;
    };

interface AuthoringNodeBase {
  readonly path: readonly string[];
  readonly label: string;
  readonly description?: string;
  readonly optional: boolean;
  readonly readOnly: boolean;
}

export interface AuthoringScalarNode extends AuthoringNodeBase {
  readonly kind: 'scalar';
  readonly scalarType: AuthoringScalarType;
  readonly value: AuthoringPrimitive | undefined;
  readonly multiline: boolean;
}

export interface AuthoringChoiceNode extends AuthoringNodeBase {
  readonly kind: 'choice';
  readonly values: readonly AuthoringPrimitive[];
  readonly value: AuthoringPrimitive | undefined;
}

interface AuthoringObjectNode extends AuthoringNodeBase {
  readonly kind: 'object';
  readonly fields: readonly AuthoringNode[];
}

interface AuthoringUnsupportedNode extends AuthoringNodeBase {
  readonly kind: 'unsupported';
  readonly diagnostic: AuthoringDiagnostic;
}

export type AuthoringNode =
  AuthoringChoiceNode | AuthoringObjectNode | AuthoringScalarNode | AuthoringUnsupportedNode;

export type AuthoringStructureResolution =
  | {
      readonly ok: true;
      readonly structure: AuthoringStructure;
    }
  | {
      readonly ok: false;
      readonly diagnostic: AuthoringDiagnostic;
    };

export type AuthoringMutation =
  | {
      readonly kind: 'set';
      readonly path: readonly string[];
      readonly value: AuthoringPrimitive;
    }
  | {
      readonly kind: 'unset';
      readonly path: readonly string[];
    };

export type AuthoringMutationResult<T> =
  | {
      readonly ok: true;
      readonly value: T;
    }
  | {
      readonly ok: false;
      readonly diagnostic: AuthoringDiagnostic;
    };
