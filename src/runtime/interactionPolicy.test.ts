import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { describe, expect, it } from 'bun:test';

const interactionPolicySource = readFileSync(join(import.meta.dir, 'interactionPolicy.ts'), 'utf8');
const indexSource = readFileSync(join(import.meta.dir, 'index.ts'), 'utf8');

describe('interactionPolicy', () => {
  it('exports InteractionPolicy type', () => {
    expect(interactionPolicySource).toContain('export type InteractionPolicy');
  });

  it('exports ThirdPartyComponentSupport as Readonly<Record<string, true>>', () => {
    expect(interactionPolicySource).toContain('ThirdPartyComponentSupport');
    expect(interactionPolicySource).toContain('Readonly<Record<string, true>>');
  });

  it('exports createStudioInteractionPolicyResolver', () => {
    expect(interactionPolicySource).toContain(
      'export function createStudioInteractionPolicyResolver',
    );
  });

  it('exports isComponentSupported', () => {
    expect(interactionPolicySource).toContain('export function isComponentSupported');
  });

  it('re-exports interactionPolicy from the runtime index', () => {
    expect(indexSource).toContain("export * from './interactionPolicy.js'");
  });

  it('assigns passive policy to built-in ZORA components in Edit mode', () => {
    expect(interactionPolicySource).toContain("return previewMode ? 'enabled' : 'passive'");
  });

  it('returns undefined policy for unsupported types', () => {
    expect(interactionPolicySource).toContain('return undefined;');
  });

  it('classifies ZORA built-in components by registry lookup', () => {
    expect(interactionPolicySource).toContain('ZORA_COMPONENT_REGISTRY');
    expect(interactionPolicySource).toContain("'zora-builtin'");
  });

  it('has a shared support model between policy and classification', () => {
    expect(interactionPolicySource).toContain('ThirdPartyComponentSupport');
    expect(interactionPolicySource).toContain('isComponentSupported');
    const supportClassifyMatch = /isComponentSupported[\s\S]{0,500}classifyComponent/.exec(
      interactionPolicySource,
    );
    expect(supportClassifyMatch).not.toBeNull();
    expect(interactionPolicySource).toContain("classification === 'unsupported'");
  });

  it('classifyComponent returns three categories', () => {
    expect(interactionPolicySource).toContain("'zora-builtin'");
    expect(interactionPolicySource).toContain("'third-party-supported'");
    expect(interactionPolicySource).toContain("'unsupported'");
  });

  it('keeps disableActions independent as a separate config concern', () => {
    const previewRuntimeSource = readFileSync(
      join(import.meta.dir, 'previewRuntimeConfig.ts'),
      'utf8',
    );

    expect(previewRuntimeSource).toContain('disableActions');
    expect(previewRuntimeSource).toContain('createStudioInteractionPolicyResolver');
  });
});
