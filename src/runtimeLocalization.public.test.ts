import { describe, expect, test } from 'bun:test';

import type {
  StudioLocalizedPropPair,
  StudioRuntimeActionHandlerContext,
  StudioRuntimeActionHandlers,
  StudioRuntimeNodePropsResolver,
  StudioRuntimeNodePropsResolverContext,
} from './runtimeLocalization';
import {
  createStudioLocalizationActionHandlers,
  createStudioLocalizationNodePropsResolver,
  getSetLanguageLocale,
  resolveLocalizedPropValue,
  STUDIO_LOCALIZED_PROP_PAIRS,
} from './runtimeLocalization';

describe('runtime localization public exports', () => {
  test('types and helpers are usable from the public module', () => {
    const pair: StudioLocalizedPropPair = STUDIO_LOCALIZED_PROP_PAIRS[0];
    const resolver: StudioRuntimeNodePropsResolver = createStudioLocalizationNodePropsResolver(
      (key) => key.toUpperCase(),
    );
    const handlers: StudioRuntimeActionHandlers = createStudioLocalizationActionHandlers(
      () => undefined,
    );
    const resolverContext: StudioRuntimeNodePropsResolverContext = {
      node: { id: 'node', type: 'Text' },
      props: { i18nKey: 'hello' },
    };
    const actionContext: StudioRuntimeActionHandlerContext = {
      action: { type: 'setLanguage', payload: { locale: 'de' } },
      context: resolverContext,
    };

    expect(pair[0]).toBe('i18nKey');
    expect(
      resolveLocalizedPropValue({
        props: resolverContext.props,
        keyProp: pair[0],
        targetProp: pair[1],
        translate: (key) => key.toUpperCase(),
      }),
    ).toBe('HELLO');
    expect(resolver(resolverContext).text).toBe('HELLO');
    expect(getSetLanguageLocale(actionContext.action)).toBe('de');
    expect(typeof handlers.setLanguage).toBe('function');
  });
});
