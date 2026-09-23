import type {
  StudioModuleAdminContribution,
  StudioModuleAdminField,
} from '../../../../moduleAdminContracts';
import type {
  AuthoringPresentationPolicy,
  AuthoringStructure,
} from '../../../../types/authoring-engine';

/*** Adapt one module-owned config-schema contribution into Studio's neutral Authoring Engine vocabulary. */
export function resolveModuleAdminAuthoring(contribution: StudioModuleAdminContribution): {
  readonly structure: AuthoringStructure;
  readonly policy: AuthoringPresentationPolicy;
} {
  return {
    structure: {
      kind: 'object',
      fields: contribution.fields.map((field) => ({
        name: field.key,
        optional: !field.required,
        structure: resolveModuleAdminFieldStructure(field),
      })),
    },
    policy: {
      label: contribution.title,
      description: contribution.description,
      fields: Object.fromEntries(
        contribution.fields.map((field) => [field.key, { label: field.label }] as const),
      ),
    },
  };
}

/*** Translate one exercised module control and fail closed for owner controls without central semantics. */
function resolveModuleAdminFieldStructure(field: StudioModuleAdminField): AuthoringStructure {
  if (field.control === 'text') {
    return { kind: 'scalar', scalarType: 'string' };
  }
  if (field.control === 'string-list') {
    return {
      kind: 'ordered-list',
      item: { kind: 'scalar', scalarType: 'string' },
    };
  }
  return {
    kind: 'unsupported',
    sourceKind: `module-control:${field.control}`,
    diagnostic: {
      code: 'unsupported-structure',
      message: `Module admin control "${field.control}" does not have a central Authoring Engine adapter.`,
      path: [field.key],
    },
  };
}
