import type { ThemeConfig } from '@ankhorage/contracts';
import { STRUCTURE_DESCRIPTOR } from '@ankhorage/contracts/structure';
import { isRecord } from '@ankhorage/utility/object';

import type {
  AuthoringNode,
  AuthoringPresentationPolicy,
  AuthoringPrimitive,
  AuthoringStructure,
} from '../../../../types/authoring-engine';
import { deriveAuthoringModel } from '../../application/use-cases/deriveAuthoringModel';
import { resolveContractsAuthoringStructure } from './resolveContractsAuthoringStructure';

/*** Derive one selected Theme authoring node from the released Contracts root plus optional resolved inheritance evidence. */
export function deriveThemeAuthoringModel(args: {
  readonly theme: ThemeConfig;
  readonly path: readonly string[];
  readonly resolvedValue?: unknown;
  readonly policy?: AuthoringPresentationPolicy;
}): AuthoringNode {
  const resolution = resolveContractsAuthoringStructure(STRUCTURE_DESCRIPTOR, 'theme-config');
  if (!resolution.ok) {
    return deriveAuthoringModel({
      structure: {
        kind: 'unsupported',
        sourceKind: 'theme-config',
        diagnostic: resolution.diagnostic,
      },
      value: undefined,
      label: 'Theme',
      path: args.path,
    });
  }

  const inheritedPolicy =
    args.resolvedValue === undefined
      ? undefined
      : createInheritancePolicy(resolution.structure, args.resolvedValue);
  const root = deriveAuthoringModel({
    structure: resolution.structure,
    value: args.theme,
    policy: args.policy ?? inheritedPolicy,
    label: 'Theme',
  });
  return findAuthoringNode(root, args.path) ?? missingThemePath(args.path);
}

/*** Project resolved owner values into scalar-leaf inheritance metadata without copying them into authored state. */
function createInheritancePolicy(
  structure: AuthoringStructure,
  value: unknown,
): AuthoringPresentationPolicy | undefined {
  if (structure.kind === 'scalar' || structure.kind === 'choice') {
    return isAuthoringPrimitive(value) ? { inheritance: { value } } : undefined;
  }

  if (!isRecord(value)) return undefined;

  if (structure.kind === 'object') {
    const fields = structure.fields.flatMap((field) => {
      const entry = Object.entries(value).find(([name]) => name === field.name);
      if (!entry) return [];
      const policy = createInheritancePolicy(field.structure, entry[1]);
      return policy ? [[field.name, policy] as const] : [];
    });
    return fields.length > 0 ? { fields: Object.fromEntries(fields) } : undefined;
  }

  if (structure.kind === 'value-map') {
    const fields = Object.entries(value).flatMap(([key, entryValue]) => {
      const policy = createInheritancePolicy(structure.value, entryValue);
      return policy ? [[key, policy] as const] : [];
    });
    return fields.length > 0 ? { fields: Object.fromEntries(fields) } : undefined;
  }

  return undefined;
}

/*** Recursively locate one derived node by its stable canonical authoring path. */
function findAuthoringNode(
  node: AuthoringNode,
  path: readonly string[],
): AuthoringNode | undefined {
  if (pathsEqual(node.path, path)) return node;
  if (node.kind === 'object') {
    return node.fields.map((field) => findAuthoringNode(field, path)).find(Boolean);
  }
  if (node.kind === 'value-map') {
    return node.entries.map((entry) => findAuthoringNode(entry.value, path)).find(Boolean);
  }
  return undefined;
}

/*** Compare two authoring paths without serializing them into an ambiguous delimiter form. */
function pathsEqual(left: readonly string[], right: readonly string[]): boolean {
  return (
    left.length === right.length && left.every((segment, index) => segment === right.at(index))
  );
}

/*** Create an explicit unsupported node when a requested Theme path is absent from the released owner root. */
function missingThemePath(path: readonly string[]): AuthoringNode {
  return deriveAuthoringModel({
    structure: {
      kind: 'unsupported',
      sourceKind: 'theme-path',
      diagnostic: {
        code: 'unresolved-reference',
        message: `Theme authoring path "${path.join('.')}" is not published by the owner structure.`,
        path,
      },
    },
    value: undefined,
    label: 'Theme',
    path,
  });
}

/*** Narrow one resolved owner value to the primitive inheritance vocabulary supported by the neutral model. */
function isAuthoringPrimitive(value: unknown): value is AuthoringPrimitive {
  return (
    value === null ||
    typeof value === 'boolean' ||
    typeof value === 'number' ||
    typeof value === 'string'
  );
}
