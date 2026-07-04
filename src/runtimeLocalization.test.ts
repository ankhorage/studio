import { describe, expect, test } from 'bun:test';

import {
  createStudioLocalizationActionHandlers,
  createStudioLocalizationNodePropsResolver,
  getSetLanguageLocale,
  resolveLocalizedPropValue,
  STUDIO_LOCALIZED_PROP_PAIRS,
} from './runtimeLocalization';

describe('runtimeLocalization', () => {
  test('exposes localized prop pairs', () => {
    expect(STUDIO_LOCALIZED_PROP_PAIRS).toContainEqual(['i18nKey', 'text']);
    expect(STUDIO_LOCALIZED_PROP_PAIRS).toContainEqual(['titleI18nKey', 'title']);
  });

  test('resolves translated prop values', () => {
    const props = { i18nKey: 'hello' };
    const value = resolveLocalizedPropValue({
      props,
      keyProp: 'i18nKey',
      targetProp: 'text',
      translate: (key) => (key === 'hello' ? 'Hallo' : key),
    });

    expect(value).toBe('Hallo');
  });

  test('falls back to the key when no target prop exists', () => {
    const props = { i18nKey: 'hello' };
    const value = resolveLocalizedPropValue({
      props,
      keyProp: 'i18nKey',
      targetProp: 'text',
      translate: (key) => key,
    });

    expect(value).toBe('hello');
  });

  test('does not overwrite an existing target prop with fallback key', () => {
    const props = { i18nKey: 'hello', text: 'Existing' };
    const value = resolveLocalizedPropValue({
      props,
      keyProp: 'i18nKey',
      targetProp: 'text',
      translate: (key) => key,
    });

    expect(value).toBeUndefined();
  });

  test('creates a node props resolver', () => {
    const resolver = createStudioLocalizationNodePropsResolver((key) =>
      key === 'hello' ? 'Hallo' : key,
    );
    const props = resolver({ node: { id: 'node', type: 'Text' }, props: { i18nKey: 'hello' } });

    expect(props).toEqual({ i18nKey: 'hello', text: 'Hallo' });
  });

  test('reads setLanguage locales defensively', () => {
    expect(getSetLanguageLocale({ type: 'setLanguage', payload: { locale: 'de' } })).toBe('de');
    expect(getSetLanguageLocale({ type: 'setLanguage', payload: { locale: '' } })).toBeUndefined();
    expect(getSetLanguageLocale({ type: 'other', payload: { locale: 'de' } })).toBeUndefined();
    expect(getSetLanguageLocale(null)).toBeUndefined();
  });

  test('creates setLanguage action handlers', () => {
    const locales: string[] = [];
    const handlers = createStudioLocalizationActionHandlers((locale) => locales.push(locale));

    handlers.setLanguage?.({
      action: { type: 'setLanguage', payload: { locale: 'fr' } },
      context: { node: { id: 'node', type: 'Button' }, props: {} },
    });

    expect(locales).toEqual(['fr']);
  });
});
