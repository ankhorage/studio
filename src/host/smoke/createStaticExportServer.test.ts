import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';

import { expect, test } from 'bun:test';

import { createStaticExportServer } from './createStaticExportServer';

test('serves both flat and nested Expo static route output', async () => {
  const projectRoot = await mkdtemp(path.join('/tmp', 'ankh-static-server-'));
  const outputRoot = path.join(projectRoot, 'dist');
  await mkdir(path.join(outputRoot, 'create'), { recursive: true });
  await Promise.all([
    writeFile(path.join(outputRoot, 'index.html'), 'root'),
    writeFile(path.join(outputRoot, 'about.html'), 'flat'),
    writeFile(path.join(outputRoot, 'create', 'index.html'), 'nested'),
  ]);
  const server = createStaticExportServer(projectRoot);

  try {
    expect(await fetchRoute(server, '/')).toBe('root');
    expect(await fetchRoute(server, '/about')).toBe('flat');
    expect(await fetchRoute(server, '/create')).toBe('nested');
    expect(await fetchRoute(server, '/missing')).toBe('Not found');
  } finally {
    await server.stop(true);
    await rm(projectRoot, { force: true, recursive: true });
  }
});

async function fetchRoute(server: ReturnType<typeof Bun.serve>, pathname: string): Promise<string> {
  if (server.port === undefined) throw new Error('Static fixture server has no port.');
  const response = await fetch(`http://127.0.0.1:${server.port}${pathname}`);
  return response.text();
}
