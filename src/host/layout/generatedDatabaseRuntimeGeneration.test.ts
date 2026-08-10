import { expect, test } from 'bun:test';

import { getProjectTemplate } from '../templateRegistry';
import { GeneratedAppFileGenerator } from './layoutGenerator';

test('generated apps register canonical generated API database adapter ids', () => {
  const manifest = getProjectTemplate({
    category: 'food_drink',
    templateId: 'nutrition-catalog-scan',
  });
  const files = new GeneratedAppFileGenerator().generateFiles('', manifest, [], {
    includeStudio: false,
  });
  const rootLayout = files.find((file) => file.path === 'src/app/_layout.tsx');
  if (!rootLayout) throw new Error('Expected generated root layout.');

  expect(rootLayout.content).toContain(
    "import { createSupabaseDbAdapter } from '@ankhorage/supabase-db';",
  );
  expect(rootLayout.content).toContain("'primary-db': generatedSupabaseDbAdapter");
  expect(rootLayout.content).toContain('databaseAdapters: GENERATED_DATABASE_ADAPTERS');
  expect(rootLayout.content).toContain('fetch: generatedSupabaseDbFetch');
  expect(rootLayout.content).toContain('getStoredAuthSession()');
  expect(rootLayout.content).toContain("headers.set('Authorization'");
  expect(rootLayout.content).not.toContain('serviceRole');
});
