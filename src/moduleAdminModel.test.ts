import { describe, expect, test } from 'bun:test';

import type { StudioModuleAdminContribution } from './moduleAdminContracts';
import { createStudioModuleAdminDraft, parseStudioModuleAdminDraft } from './moduleAdminModel';

const contribution: StudioModuleAdminContribution = {
  kind: 'config-schema',
  title: 'Example',
  description: 'Example schema',
  fields: [
    { key: 'name', label: 'Name', control: 'text', required: true },
    { key: 'tags', label: 'Tags', control: 'string-list', required: true },
    {
      key: 'metadata',
      label: 'Metadata',
      control: 'structured-json',
      required: false,
    },
  ],
};

describe('moduleAdminModel', () => {
  test('round-trips a package-owned serializable config schema', () => {
    const config = {
      name: 'Example',
      tags: ['mobile', 'public'],
      metadata: { retries: 3, enabled: true },
      packageOwnedExtra: true,
    };
    const draft = createStudioModuleAdminDraft({ contribution, config });
    const result = parseStudioModuleAdminDraft({ contribution, currentConfig: config, draft });

    expect(draft.tags).toBe('mobile, public');
    expect(result).toEqual({ ok: true, config });

    expect(
      parseStudioModuleAdminDraft({
        contribution,
        currentConfig: config,
        draft: { ...draft, metadata: '["one", 2, true]' },
      }),
    ).toEqual({
      ok: true,
      config: { ...config, metadata: ['one', 2, true] },
    });
  });

  test('validates only generic required and JSON syntax constraints', () => {
    expect(
      parseStudioModuleAdminDraft({
        contribution,
        currentConfig: {},
        draft: { name: '', tags: 'mobile', metadata: '{}' },
      }),
    ).toEqual({ ok: false, message: 'Name is required.' });
    expect(
      parseStudioModuleAdminDraft({
        contribution,
        currentConfig: {},
        draft: { name: 'Example', tags: 'mobile', metadata: '{invalid' },
      }),
    ).toEqual({
      ok: false,
      message: 'Metadata must be valid JSON.',
    });
  });
});
