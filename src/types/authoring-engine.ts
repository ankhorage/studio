import type { MediaAssetKind } from '@ankhorage/contracts';

export type AuthoringScalarType = 'boolean' | 'integer' | 'null' | 'number' | 'string';

export type AuthoringPrimitive = boolean | number | string | null;

export type AuthoringValue =
  AuthoringPrimitive | readonly AuthoringValue[] | { readonly [key: string]: AuthoringValue };

export interface AuthoringDiagnostic {
  readonly code:
    'invalid-value' | 'mutation-rejected' | 'unresolved-reference' | 'unsupported-structure';
  readonly message: string;
  readonly path: readonly string[];
}

interface AuthoringEditorHint {
  readonly kind: string;
  readonly mediaKinds?: readonly MediaAssetKind[];
}

export interface AuthoringPresentationPolicy {
  readonly label?: string;
  readonly description?: string;
  readonly readOnly?: boolean;
  readonly multiline?: boolean;
  readonly inheritance?: { readonly value?: AuthoringPrimitive };
  readonly editor?: AuthoringEditorHint;
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
      readonly kind: 'set';
      readonly member: AuthoringStructure;
    }
  | {
      readonly kind: 'ordered-list';
      readonly item: AuthoringStructure;
    }
  | {
      readonly kind: 'value-map';
      readonly key: AuthoringStructure;
      readonly value: AuthoringStructure;
    }
  | {
      readonly kind: 'entity-registry';
      readonly key: AuthoringStructure;
      readonly value: AuthoringStructure;
      readonly identityField?: string;
    }
  | {
      readonly kind: 'union';
      readonly variants: readonly AuthoringStructure[];
      readonly discriminator?: string;
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
  readonly editor?: AuthoringEditorHint;
  readonly inheritance?: {
    readonly value?: AuthoringPrimitive;
    readonly overridden: boolean;
  };
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

export interface AuthoringSetNode extends AuthoringNodeBase {
  readonly kind: 'set';
  readonly values: readonly string[];
  readonly selected: readonly string[];
}

export type AuthoringOrderedListItem =
  | {
      readonly kind: 'choice';
      readonly values: readonly AuthoringPrimitive[];
    }
  | {
      readonly kind: 'scalar';
      readonly scalarType: 'string';
    };

export interface AuthoringOrderedListNode extends AuthoringNodeBase {
  readonly kind: 'ordered-list';
  readonly item: AuthoringOrderedListItem;
  readonly items: readonly AuthoringPrimitive[];
}

export type AuthoringCollectionKey =
  | {
      readonly kind: 'choice';
      readonly values: readonly string[];
    }
  | {
      readonly kind: 'scalar';
      readonly scalarType: 'string';
    };

export type AuthoringValueMapKey = AuthoringCollectionKey;

interface AuthoringValueMapEntry {
  readonly key: string;
  readonly authored: boolean;
  readonly value: AuthoringNode;
}

export interface AuthoringValueMapNode extends AuthoringNodeBase {
  readonly kind: 'value-map';
  readonly key: AuthoringValueMapKey;
  readonly valueStructure: AuthoringStructure;
  readonly entries: readonly AuthoringValueMapEntry[];
}

interface AuthoringEntityRegistryEntry {
  readonly key: string;
  readonly value: AuthoringNode;
}

export interface AuthoringEntityRegistryNode extends AuthoringNodeBase {
  readonly kind: 'entity-registry';
  readonly key: AuthoringCollectionKey;
  readonly valueStructure: AuthoringStructure;
  readonly identityField?: string;
  readonly entries: readonly AuthoringEntityRegistryEntry[];
}

export interface AuthoringUnionVariant {
  readonly value: AuthoringPrimitive;
  readonly structure: AuthoringStructure;
}

export interface AuthoringUnionNode extends AuthoringNodeBase {
  readonly kind: 'union';
  readonly discriminator: string;
  readonly variants: readonly AuthoringUnionVariant[];
  readonly selected: AuthoringPrimitive | undefined;
  readonly authoredValue: Readonly<Record<string, unknown>> | undefined;
  readonly value: AuthoringNode | undefined;
}

interface AuthoringUnsupportedNode extends AuthoringNodeBase {
  readonly kind: 'unsupported';
  readonly diagnostic: AuthoringDiagnostic;
}

export type AuthoringNode =
  | AuthoringChoiceNode
  | AuthoringEntityRegistryNode
  | AuthoringObjectNode
  | AuthoringOrderedListNode
  | AuthoringScalarNode
  | AuthoringSetNode
  | AuthoringUnionNode
  | AuthoringUnsupportedNode
  | AuthoringValueMapNode;

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
      readonly value: AuthoringValue;
    }
  | {
      readonly kind: 'unset';
      readonly path: readonly string[];
    }
  | {
      readonly kind: 'rename-key';
      readonly path: readonly string[];
      readonly fromKey: string;
      readonly toKey: string;
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
