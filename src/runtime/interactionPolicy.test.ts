import { describe, expect, it } from 'bun:test';

import { createStudioInteractionPolicyResolver } from './interactionPolicy';

describe('interactionPolicy', () => {
  it('assigns passive policy to ZORA components in Edit mode', () => {
    const resolver = createStudioInteractionPolicyResolver({ previewMode: false });
    const result = resolver({
      node: { id: 'test', type: 'Text' },
      props: { children: 'Hello' },
    });

    expect(result.interactionPolicy).toBe('passive');
  });

  it('assigns enabled policy to ZORA components in Preview mode', () => {
    const resolver = createStudioInteractionPolicyResolver({ previewMode: true });
    const result = resolver({
      node: { id: 'test', type: 'Text' },
      props: { children: 'Hello' },
    });

    expect(result.interactionPolicy).toBe('enabled');
  });

  it('preserves existing resolver output', () => {
    const existingResolver = (() => {
      const base = { fontSize: 16 };
      return (_args: unknown) => base;
    })();

    const resolver = createStudioInteractionPolicyResolver({
      previewMode: true,
      existingResolver,
    });
    const result = resolver({
      node: { id: 'test', type: 'Text' },
      props: { children: 'Hello' },
    });

    expect(result.interactionPolicy).toBe('enabled');
    expect(result.fontSize).toBe(16);
  });

  it('preserves unrelated props from existing resolver', () => {
    const existingResolver = (() => {
      return (_args: unknown) => ({ customProp: 'value' });
    })();

    const resolver = createStudioInteractionPolicyResolver({
      previewMode: false,
      existingResolver,
    });
    const result = resolver({
      node: { id: 'test', type: 'Text' },
      props: { children: 'Hello' },
    });

    expect(result.customProp).toBe('value');
  });

  it('assigns mode-derived policy to opted-in third-party components', () => {
    const resolver = createStudioInteractionPolicyResolver({
      previewMode: false,
      thirdPartySupport: { CustomComponent: true },
    });
    const result = resolver({
      node: { id: 'test', type: 'CustomComponent' },
      props: {},
    });

    expect(result.interactionPolicy).toBe('passive');
  });

  it('assigns enabled policy to opted-in third-party in Preview mode', () => {
    const resolver = createStudioInteractionPolicyResolver({
      previewMode: true,
      thirdPartySupport: { CustomComponent: true },
    });
    const result = resolver({
      node: { id: 'test', type: 'CustomComponent' },
      props: {},
    });

    expect(result.interactionPolicy).toBe('enabled');
  });

  it('assigns no policy to undeclared third-party components', () => {
    const resolver = createStudioInteractionPolicyResolver({
      previewMode: false,
      thirdPartySupport: { CustomComponent: true },
    });
    const result = resolver({
      node: { id: 'test', type: 'ThirdPartyComponent' },
      props: {},
    });

    expect(result.interactionPolicy).toBeUndefined();
  });

  it('assigns no policy to unknown types', () => {
    const resolver = createStudioInteractionPolicyResolver({ previewMode: false });
    const result = resolver({
      node: { id: 'test', type: 'UnknownWidget' },
      props: {},
    });

    expect(result.interactionPolicy).toBeUndefined();
  });

  it('third-party support cannot override mode policy direction', () => {
    const resolver = createStudioInteractionPolicyResolver({
      previewMode: false,
      thirdPartySupport: { CustomComponent: true },
    });
    const editResult = resolver({
      node: { id: 'test', type: 'CustomComponent' },
      props: {},
    });

    const resolverPreview = createStudioInteractionPolicyResolver({
      previewMode: true,
      thirdPartySupport: { CustomComponent: true },
    });
    const previewResult = resolverPreview({
      node: { id: 'test', type: 'CustomComponent' },
      props: {},
    });

    expect(editResult.interactionPolicy).not.toBe(previewResult.interactionPolicy);
    expect(editResult.interactionPolicy).toBe('passive');
    expect(previewResult.interactionPolicy).toBe('enabled');
  });
});
