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

test('resolves the released auth profile structure for descriptor-driven authoring', () => {
  const result = resolveContractsAuthoringStructure(STRUCTURE_DESCRIPTOR, 'auth-profile');

  expect(result).toEqual({
    ok: true,
    structure: {
      kind: 'object',
      fields: [
        {
          name: 'createStrategy',
          optional: true,
          structure: { kind: 'choice', values: ['api', 'app', 'trigger'] },
        },
        {
          name: 'fields',
          optional: false,
          structure: {
            kind: 'ordered-list',
            item: { kind: 'scalar', scalarType: 'string' },
          },
        },
        {
          name: 'primaryKey',
          optional: true,
          structure: { kind: 'choice', values: ['authUserId'] },
        },
        {
          name: 'table',
          optional: true,
          structure: { kind: 'scalar', scalarType: 'string' },
        },
        {
          name: 'updateStrategy',
          optional: true,
          structure: { kind: 'choice', values: ['api', 'app'] },
        },
      ],
    },
  });
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

test('resolves the released auth sign-up open ordered field structure', () => {
  const result = resolveContractsAuthoringStructure(STRUCTURE_DESCRIPTOR, 'auth-sign-up');

  expect(result).toEqual({
    ok: true,
    structure: {
      kind: 'object',
      fields: [
        {
          name: 'optionalFields',
          optional: true,
          structure: {
            kind: 'ordered-list',
            item: { kind: 'scalar', scalarType: 'string' },
          },
        },
        {
          name: 'requiredFields',
          optional: false,
          structure: {
            kind: 'ordered-list',
            item: { kind: 'scalar', scalarType: 'string' },
          },
        },
        {
          name: 'signUpPolicy',
          optional: true,
          structure: {
            kind: 'choice',
            values: ['autoSignIn', 'requireVerification'],
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

test('preserves canonical value-map semantics from Contracts descriptors', () => {
  const document = {
    protocolVersion: 1,
    packageName: '@example/owner',
    packageVersion: '1.0.0',
    roots: { tokens: 'Tokens' },
    descriptors: {
      Tokens: {
        id: 'Tokens',
        descriptor: {
          kind: 'value-map',
          key: { kind: 'scalar', type: 'string' },
          value: { kind: 'scalar', type: 'number' },
        },
      },
    },
  } as const satisfies StructureDescriptorDocument;

  expect(resolveContractsAuthoringStructure(document, 'tokens')).toEqual({
    ok: true,
    structure: {
      kind: 'value-map',
      key: { kind: 'scalar', scalarType: 'string' },
      value: { kind: 'scalar', scalarType: 'number' },
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
