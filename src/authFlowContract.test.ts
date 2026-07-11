import { readdir, readFile } from 'node:fs/promises';
import { basename, join } from 'node:path';

import { describe, expect, it } from 'bun:test';

async function collectFiles(directory: string): Promise<string[]> {
  const entries = await readdir(directory, { withFileTypes: true });
  const files: string[] = [];

  for (const entry of entries) {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) {
      files.push(...(await collectFiles(path)));
    } else if (entry.isFile()) {
      files.push(path);
    }
  }

  return files;
}

describe('canonical Studio auth-flow contract', () => {
  it('does not reference the removed settings auth-flow path', async () => {
    const removedPath = 'settings.' + 'authFlow';
    const roots = [join(process.cwd(), 'src'), join(process.cwd(), 'apps')];

    for (const root of roots) {
      const files = await collectFiles(root);
      for (const file of files) {
        if (basename(file) === 'authFlowContract.test.ts') continue;
        const content = await readFile(file, 'utf8');
        expect(content.includes(removedPath)).toBe(false);
      }
    }
  });
});
