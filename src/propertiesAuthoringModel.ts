import type { UiNode } from '@ankhorage/contracts';

export interface StudioAuthoringPropSchema {
  readonly type: string;
  readonly category: string;
  readonly label?: string;
  readonly enum?: readonly (string | number)[];
  readonly default?: unknown;
  readonly authoring?: {
    readonly authority: string;
  };
}

export interface StudioAuthoringComponentMeta {
  readonly name: string;
  readonly props: Readonly<Record<string, StudioAuthoringPropSchema>>;
}

export type StudioAuthoringMetaRegistry = Readonly<
  Record<string, StudioAuthoringComponentMeta | undefined>
>;

export type StudioInstancePropertyEditorKind =
  | 'text'
  | 'number'
  | 'boolean'
  | 'choice'
  | 'unsupported';

export interface StudioInstancePropertyField {
  readonly name: string;
  readonly label: string;
  readonly category: string;
  readonly schemaType: string;
  readonly editor: StudioInstancePropertyEditorKind;
  readonly options: readonly (string | number)[];
  readonly value: unknown;
  readonly defaultValue: unknown;
  readonly isExplicit: boolean;
}

export interface StudioInstancePropertyGroup {
  readonly category: string;
  readonly fields: readonly StudioInstancePropertyField[];
}

export type StudioInstancePropertyValue = string | number | boolean;

export function resolveStudioInstancePropertyFields(
  node: UiNode,
  registry: StudioAuthoringMetaRegistry,
): readonly StudioInstancePropertyField[] {
  const componentMeta = new Map(Object.entries(registry)).get(node.type);
  if (!componentMeta) return [];

  const propValues = new Map(Object.entries(node.props ?? {}));

  return Object.entries(componentMeta.props).flatMap(([name, schema]) => {
    if (schema.authoring?.authority !== 'instance') return [];

    const isExplicit = propValues.has(name);
    return [
      {
        name,
        label: schema.label ?? name,
        category: schema.category,
        schemaType: schema.type,
        editor: resolveEditorKind(schema),
        options: schema.enum ?? [],
        value: isExplicit ? propValues.get(name) : schema.default,
        defaultValue: schema.default,
        isExplicit,
      },
    ];
  });
}

export function resolveStudioInstancePropertyGroups(
  node: UiNode,
  registry: StudioAuthoringMetaRegistry,
): readonly StudioInstancePropertyGroup[] {
  const groups = new Map<string, StudioInstancePropertyField[]>();

  for (const field of resolveStudioInstancePropertyFields(node, registry)) {
    const current = groups.get(field.category) ?? [];
    current.push(field);
    groups.set(field.category, current);
  }

  return Array.from(groups, ([category, fields]) => ({ category, fields }));
}

export function createStudioInstancePropertyPatch(
  node: UiNode,
  propertyName: string,
  value: StudioInstancePropertyValue | undefined,
): Readonly<Record<string, unknown>> {
  const entries = Object.entries(node.props ?? {}).filter(([name]) => name !== propertyName);
  if (value !== undefined) {
    entries.push([propertyName, value]);
  }

  return { props: Object.fromEntries(entries) };
}

function resolveEditorKind(
  schema: StudioAuthoringPropSchema,
): StudioInstancePropertyEditorKind {
  if (schema.type === 'string') return 'text';
  if (schema.type === 'number') return 'number';
  if (schema.type === 'boolean') return 'boolean';
  if (schema.type === 'enum' && (schema.enum?.length ?? 0) > 0) return 'choice';
  return 'unsupported';
}
