import { describe, expect, test } from 'bun:test';

import type { StudioModuleAdminContribution } from './moduleAdminContracts';
import { createStudioModuleAdminDraft, parseStudioModuleAdminDraft } from './moduleAdminModel';

const contribution: StudioModuleAdminContribution = {
  kind: 'config-schema',
  title: 'Example',
  description: 'Example schema',
  fields: [
    { key: 'defaultLocale', label: 'Default locale', control: 'text', required: true },
    { key: 'locales', label: 'Locales', control: 'string-list', required: true },
    {
      key: 'translations',
      label: 'Translations',
      control: 'locale-string-map',
      required: false,
    },
  ],
};

describe('moduleAdminModel', () => {
  test('round-trips a package-owned serializable config schema', () => {
    const config = {
      defaultLocale: 'en',
      locales: ['en', 'de'],
      translations: { en: { hello: 'Hello' } },
      packageOwnedExtra: true,
    };
    const draft = createStudioModuleAdminDraft({ contribution, config });
    const result = parseStudioModuleAdminDraft({ contribution, currentConfig: config, draft });

    expect(draft.locales).toBe('en, de');
    expect(result).toEqual({ ok: true, config });
  });

  test('rejects invalid required and locale-map values locally', () => {
    expect(
      parseStudioModuleAdminDraft({
        contribution,
        currentConfig: {},
        draft: { defaultLocale: '', locales: 'en', translations: '{}' },
      }),
    ).toEqual({ ok: false, message: 'Default locale is required.' });
    expect(
      parseStudioModuleAdminDraft({
        contribution,
        currentConfig: {},
        draft: { defaultLocale: 'en', locales: 'en', translations: '[]' },
      }),
    ).toEqual({
      ok: false,
      message: 'Translations must map locale IDs to string dictionaries.',
    });
  });
});
