import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { describe, expect, it } from 'bun:test';

import {
  composeInteractionPolicyResolver,
  createInteractionPolicyResolver,
  isComponentSupported,
} from './interactionPolicyCore';

describe('interactionPolicyCore', () => {
  it('assigns passive policy to supported components in Edit mode', () => {
    const resolver = createInteractionPolicyResolver({
      previewMode: false,
      isSupportedNodeType: () => true,
    });
    const result = resolver({
      node: { type: 'Text' },
      props: { children: 'Hello' },
    });

    expect(result.interactionPolicy).toBe('passive');
  });

  it('assigns enabled policy to supported components in Preview mode', () => {
    const resolver = createInteractionPolicyResolver({
      previewMode: true,
      isSupportedNodeType: () => true,
    });
    const result = resolver({
      node: { type: 'Text' },
      props: { children: 'Hello' },
    });

    expect(result.interactionPolicy).toBe('enabled');
  });

  it('preserves props from resolve args', () => {
    const resolver = createInteractionPolicyResolver({
      previewMode: true,
      isSupportedNodeType: () => true,
    });

    const result = resolver({
      node: { type: 'Text' },
      props: { fontSize: 16 },
    });

    expect(result.interactionPolicy).toBe('enabled');
    expect(result.fontSize).toBe(16);
  });

  it('preserves unrelated props from resolve args', () => {
    const resolver = createInteractionPolicyResolver({
      previewMode: false,
      isSupportedNodeType: () => true,
    });

    const result = resolver({
      node: { type: 'Text' },
      props: { customProp: 'value' },
    });

    expect(result.customProp).toBe('value');
  });

  it('assigns mode-derived policy to opted-in third-party components', () => {
    const resolver = createInteractionPolicyResolver({
      previewMode: false,
      thirdPartySupport: { CustomComponent: true },
      isSupportedNodeType: () => false,
    });
    const result = resolver({
      node: { type: 'CustomComponent' },
      props: {},
    });

    expect(result.interactionPolicy).toBe('passive');
  });

  it('assigns enabled policy to opted-in third-party in Preview mode', () => {
    const resolver = createInteractionPolicyResolver({
      previewMode: true,
      thirdPartySupport: { CustomComponent: true },
      isSupportedNodeType: () => false,
    });
    const result = resolver({
      node: { type: 'CustomComponent' },
      props: {},
    });

    expect(result.interactionPolicy).toBe('enabled');
  });

  it('assigns no policy to undeclared third-party components', () => {
    const resolver = createInteractionPolicyResolver({
      previewMode: false,
      thirdPartySupport: { CustomComponent: true },
      isSupportedNodeType: () => false,
    });
    const result = resolver({
      node: { type: 'ThirdPartyComponent' },
      props: {},
    });

    expect(result.interactionPolicy).toBeUndefined();
  });

  it('does not infer support from third-party registry membership', () => {
    const registeredThirdPartyTypes = new Set(['RegisteredOnlyComponent']);
    const resolver = createInteractionPolicyResolver({
      previewMode: false,
      isSupportedNodeType: () => false,
    });
    const result = resolver({
      node: { type: 'RegisteredOnlyComponent' },
      props: { registered: registeredThirdPartyTypes.has('RegisteredOnlyComponent') },
    });

    expect(result.registered).toBe(true);
    expect(result.interactionPolicy).toBeUndefined();
  });

  it('assigns no policy to unknown types', () => {
    const resolver = createInteractionPolicyResolver({
      previewMode: false,
      isSupportedNodeType: () => false,
    });
    const result = resolver({
      node: { type: 'UnknownWidget' },
      props: {},
    });

    expect(result.interactionPolicy).toBeUndefined();
  });

  it('third-party support cannot override mode policy direction', () => {
    const resolver = createInteractionPolicyResolver({
      previewMode: false,
      thirdPartySupport: { CustomComponent: true },
      isSupportedNodeType: () => false,
    });
    const editResult = resolver({
      node: { type: 'CustomComponent' },
      props: {},
    });

    const resolverPreview = createInteractionPolicyResolver({
      previewMode: true,
      thirdPartySupport: { CustomComponent: true },
      isSupportedNodeType: () => false,
    });
    const previewResult = resolverPreview({
      node: { type: 'CustomComponent' },
      props: {},
    });

    expect(editResult.interactionPolicy).not.toBe(previewResult.interactionPolicy);
    expect(editResult.interactionPolicy).toBe('passive');
    expect(previewResult.interactionPolicy).toBe('enabled');
  });

  it('isComponentSupported returns false for inherited prototype names', () => {
    expect(isComponentSupported('constructor', {}, () => false)).toBe(false);
    expect(isComponentSupported('toString', {}, () => false)).toBe(false);
    expect(isComponentSupported('valueOf', {}, () => false)).toBe(false);
    expect(isComponentSupported('__proto__', {}, () => false)).toBe(false);
  });

  it('isComponentSupported returns true for an explicit own third-party entry', () => {
    expect(isComponentSupported('CustomWidget', { CustomWidget: true }, () => false)).toBe(true);
  });

  it('isComponentSupported returns true for zora-builtin', () => {
    expect(isComponentSupported('Text', {}, () => true)).toBe(true);
  });

  it('isComponentSupported returns true for third-party-supported', () => {
    expect(isComponentSupported('Custom', { Custom: true }, () => false)).toBe(true);
  });

  it('isComponentSupported returns false for unsupported', () => {
    expect(isComponentSupported('Unknown', {}, () => false)).toBe(false);
  });

  it('preserves existing Runtime resolver output while adding policy', () => {
    const policyResolver = createInteractionPolicyResolver({
      previewMode: false,
      thirdPartySupport: { CustomWidget: true },
      isSupportedNodeType: () => false,
    });
    const resolver = composeInteractionPolicyResolver(policyResolver, ({ props }) => ({
      ...props,
      existingResolver: 'preserved',
    }));

    expect(
      resolver({
        node: { type: 'CustomWidget' },
        props: { authored: 'preserved' },
      }),
    ).toEqual({
      authored: 'preserved',
      existingResolver: 'preserved',
      interactionPolicy: 'passive',
    });
  });
});

describe('interactionPolicy production adapter', () => {
  const sourcePath = join(import.meta.dir, 'interactionPolicy.ts');
  const source = readFileSync(sourcePath, 'utf8');

  it('derives support from the actual ZORA_COMPONENT_REGISTRY', () => {
    expect(source).toContain("from '@ankhorage/zora'");
    expect(source).toContain('ZORA_COMPONENT_REGISTRY');
    expect(source).toContain(
      'Object.prototype.hasOwnProperty.call(ZORA_COMPONENT_REGISTRY, nodeType)',
    );
  });

  it('delegates classification to the pure core', () => {
    expect(source).toContain('createInteractionPolicyResolver');
    expect(source).toContain('composeInteractionPolicyResolver');
  });
});

describe('preview Runtime config production wiring', () => {
  const sourcePath = join(import.meta.dir, 'previewRuntimeConfig.ts');
  const source = readFileSync(sourcePath, 'utf8');

  it('threads support and inherited resolver options independently from registry membership', () => {
    expect(source).toContain('readonly components?: ComponentRegistry;');
    expect(source).toContain('readonly interactionPolicySupport?: ThirdPartyComponentSupport;');
    expect(source).toContain(
      "readonly resolveNodeProps?: RuntimeRendererConfig['resolveNodeProps'];",
    );
    expect(source).toContain('thirdPartySupport: options.interactionPolicySupport');
    expect(source).toContain('existingResolver: options.resolveNodeProps');
  });
});
