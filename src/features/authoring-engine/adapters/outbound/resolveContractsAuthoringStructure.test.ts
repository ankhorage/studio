import {
  STRUCTURE_DESCRIPTOR,
  type StructureDescriptorDocument,
} from '@ankhorage/contracts/structure';
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

test('resolves the released auth flow root for descriptor-driven route authoring', () => {
  const result = resolveContractsAuthoringStructure(STRUCTURE_DESCRIPTOR, 'auth-flow');

  expect(result.ok).toBe(true);
  if (!result.ok || result.structure.kind !== 'object') return;

  expect(
    result.structure.fields.map((field) => ({
      name: field.name,
      optional: field.optional,
      kind: field.structure.kind,
    })),
  ).toEqual([
    { name: 'forgotPasswordRoute', optional: true, kind: 'scalar' },
    { name: 'otpRoute', optional: true, kind: 'scalar' },
    { name: 'postSignInRoute', optional: false, kind: 'scalar' },
    { name: 'signInRoute', optional: false, kind: 'scalar' },
    { name: 'signOutRoute', optional: true, kind: 'scalar' },
    { name: 'signUpRoute', optional: true, kind: 'scalar' },
    { name: 'unauthorizedRoute', optional: true, kind: 'scalar' },
  ]);
});

test('resolves the released auth sign-in ordered identifier structure', () => {
  const result = resolveContractsAuthoringStructure(STRUCTURE_DESCRIPTOR, 'auth-sign-in');

  expect(result).toEqual({
    ok: true,
    structure: {
      kind: 'object',
      fields: [
        {
          name: 'identifiers',
          optional: false,
          structure: {
            kind: 'ordered-list',
            item: { kind: 'choice', values: ['email', 'phone', 'username'] },
          },
        },
      ],
    },
  });
});

test('preserves canonical set semantics from Contracts descriptors', () => {
  const document = {
    protocolVersion: 1,
    packageName: '@example/owner',
    packageVersion: '1.0.0',
    roots: { requirements: 'Requirements' },
    descriptors: {
      Requirements: {
        id: 'Requirements',
        descriptor: {
          kind: 'object',
          fields: {
            permissions: {
              optional: true,
              value: {
                kind: 'set',
                member: { kind: 'enum', values: ['camera', 'microphone'] },
              },
            },
          },
        },
      },
    },
  } as const satisfies StructureDescriptorDocument;

  expect(resolveContractsAuthoringStructure(document, 'requirements')).toEqual({
    ok: true,
    structure: {
      kind: 'object',
      fields: [
        {
          name: 'permissions',
          optional: true,
          structure: {
            kind: 'set',
            member: { kind: 'choice', values: ['camera', 'microphone'] },
          },
        },
      ],
    },
  });
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
