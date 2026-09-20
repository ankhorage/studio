import { STRUCTURE_DESCRIPTOR } from '@ankhorage/contracts/structure';
import { expect, test } from 'bun:test';

import { resolveContractsAuthoringStructure } from './resolveContractsAuthoringStructure';

test('resolves the released screen metadata root without a Studio-local schema', () => {
  const result = resolveContractsAuthoringStructure(STRUCTURE_DESCRIPTOR, 'screen-metadata');

  expect(result.ok).toBe(true);
  if (!result.ok || result.structure.kind !== 'object') return;

  expect(
    result.structure.fields.map((field) => ({
      name: field.name,
      optional: field.optional,
      kind: field.structure.kind,
    })),
  ).toEqual([
    { name: 'description', optional: true, kind: 'scalar' },
    { name: 'id', optional: false, kind: 'scalar' },
    { name: 'name', optional: false, kind: 'scalar' },
    { name: 'title', optional: true, kind: 'scalar' },
  ]);
});

test('reports missing roots rather than guessing an editor', () => {
  const result = resolveContractsAuthoringStructure(STRUCTURE_DESCRIPTOR, 'missing-root');

  expect(result).toEqual({
    ok: false,
    diagnostic: {
      code: 'unresolved-reference',
      message: 'Structure root "missing-root" is not published by @ankhorage/contracts.',
      path: [],
    },
  });
});
