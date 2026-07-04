import { describe, expect, test } from 'bun:test';

import type { StudioLocalizedPropPair } from './runtimeLocalization';
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
    const resolver = createStudioLocalizationNodePropsResolver((key) => key.toUpperCase());
    const handlers = createStudioLocalizationActionHandlers(() => undefined);

    expect(pair[0]).toBe('i18nKey');
    expect(
      resolveLocalizedPropValue({
        props: { i18nKey: 'hello' },
        keyProp: pair[0],
        targetProp: pair[1],
        translate: (key) => key.toUpperCase(),
      }),
    ).toBe('HELLO');
    expect(typeof resolver).toBe('function');
    expect(getSetLanguageLocale({ type: 'setLanguage', payload: { locale: 'de' } })).toBe('de');
    expect(typeof handlers.setLanguage).toBe('function');
  });
});
