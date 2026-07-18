import { expect, test } from 'bun:test';
import { readFileSync } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

test('uses the URL as the admin route source of truth', () => {
  const source = readFileSync(
    path.join(path.dirname(fileURLToPath(import.meta.url)), 'useStudioAppBarAugmentation.ts'),
    'utf8',
  );

  expect(source).toContain('usePathname()');
  expect(source).toContain('useRouter()');
  expect(source).toContain("router.push('/ankh')");
  expect(source).not.toContain('setLastNonAdminLocation');
  expect(source).toContain('Administration');
  expect(source).not.toContain('StudioAuthSettingsOverlay');
  expect(source).not.toContain('StudioAdminOverlay');
  expect(source).not.toContain('useState<');
  expect(source).not.toContain('setActiveRoute');
});
