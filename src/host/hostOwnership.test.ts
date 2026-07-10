import { describe, expect, test } from 'bun:test';
import { mkdtemp, mkdir, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';

import { assertProjectId, getProjectPath } from './orchestrator/projectPaths';
import { resolveWorkspaceRoot } from './utils/workspaceRoot';
import { isOriginAllowed } from './http/security';

describe('local Studio host ownership', () => {
  test('rejects path traversal and the reserved Studio app id', () => {
    expect(() => assertProjectId('../outside')).toThrow();
    expect(() => assertProjectId('studio')).toThrow();
    expect(() => getProjectPath('/tmp/workspace', 'valid-app')).not.toThrow();
  });

  test('allows only local development origins', () => {
    expect(isOriginAllowed('http://localhost:8081')).toBe(true);
    expect(isOriginAllowed('http://127.0.0.1:8081')).toBe(true);
    expect(isOriginAllowed('https://example.com')).toBe(false);
  });

  test('resolves a standalone Studio workspace without a packages directory', async () => {
    const root = await mkdtemp(path.join(tmpdir(), 'ankhorage-studio-host-'));
    await mkdir(path.join(root, 'apps', 'studio'), { recursive: true });
    await writeFile(path.join(root, 'package.json'), JSON.stringify({ name: '@ankhorage/studio' }));
    expect(resolveWorkspaceRoot(path.join(root, 'apps', 'studio'))).toBe(root);
  });
});
