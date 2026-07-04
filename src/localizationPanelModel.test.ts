import type { UiNode } from '@ankhorage/contracts';
import { describe, expect, test } from 'bun:test';

import {
  collectTranslatableFields,
  createLocaleAddConfig,
  createLocaleRemoveConfig,
  createLocalizationKeyFromText,
  filterTranslatableFields,
} from './localizationPanelModel';

const ROOT_NODE: UiNode = {
  id: 'root',
  type: 'Box',
  alias: 'Root',
  props: {},
  children: [
    {
      id: 'title',
      type: 'Text',
      props: { i18nKey: 'home.title', text: 'Welcome Home' },
    },
  ],
};

const META = {
  Text: {
    i18n: {
      fields: [{ keyProp: 'i18nKey', defaultTextProp: 'text' }],
    },
  },
};

describe('localizationPanelModel', () => {
  test('collects translatable fields', () => {
    expect(
      collectTranslatableFields({ root: ROOT_NODE, componentMeta: META, screenId: 'home' }),
    ).toEqual([
      {
        screenId: 'home',
        nodeId: 'title',
        componentName: 'Text',
        keyProp: 'i18nKey',
        defaultTextProp: 'text',
        currentKey: 'home.title',
        defaultText: 'Welcome Home',
        path: 'home > Root > Text',
      },
    ]);
  });

  test('creates localization keys from text', () => {
    expect(createLocalizationKeyFromText(' Welcome Home! ')).toBe('welcome_home');
    expect(createLocalizationKeyFromText('CTA - Primary')).toBe('cta_-_primary');
  });

  test('filters missing translatable fields', () => {
    const fields = collectTranslatableFields({
      root: ROOT_NODE,
      componentMeta: META,
      screenId: 'home',
    });

    expect(
      filterTranslatableFields({
        fields,
        searchQuery: 'welcome',
        showOnlyMissing: true,
        activeLocale: 'de',
        dictionaries: { de: {} },
      }),
    ).toHaveLength(1);
    expect(
      filterTranslatableFields({
        fields,
        searchQuery: 'welcome',
        showOnlyMissing: true,
        activeLocale: 'de',
        dictionaries: { de: { 'home.title': 'Willkommen' } },
      }),
    ).toHaveLength(0);
  });

  test('creates add and remove locale configs', () => {
    expect(createLocaleAddConfig({ currentLocales: ['en'], localeInput: ' DE ' })).toEqual({
      locale: 'de',
      nextLocales: ['en', 'de'],
    });
    expect(createLocaleAddConfig({ currentLocales: ['en'], localeInput: 'en' })).toBeNull();
    expect(
      createLocaleRemoveConfig({
        locales: ['en', 'de'],
        defaultLocale: 'de',
        localeToRemove: 'de',
      }),
    ).toEqual({ nextLocales: ['en'], nextDefaultLocale: 'en' });
  });
});
