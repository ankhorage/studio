import { expect, test } from 'bun:test';
import { readFileSync } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const source = readFileSync(
  path.join(path.dirname(fileURLToPath(import.meta.url)), 'AnkhAdminPage.tsx'),
  'utf8',
);

test('uses a declarative UI page registry for every admin route id', () => {
  expect(source).toContain('ADMIN_PAGE_RENDERERS');
  expect(source).toContain('satisfies Record<StudioAdminRouteId, AdminPageRenderer>');
  expect(source).not.toContain("if (routeId === '");
});

test('uses canonical properties decoding in the public page boundary', () => {
  expect(source).toContain('resolveStudioPropertiesNodeId');
  expect(source).not.toContain("'/ankh/properties/' +");
  expect(source).not.toContain('`/ankh/properties/${');
});
