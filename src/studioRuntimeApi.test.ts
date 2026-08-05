import { afterEach, expect, mock, test } from 'bun:test';

import { syncStudioRuntime } from './studioRuntimeApi';

const originalFetch = globalThis.fetch;

afterEach(() => {
  globalThis.fetch = originalFetch;
});

test('syncStudioRuntime loads the persisted draft and applies it to the generated runtime', async () => {
  const requests: Array<{ url: string; init?: RequestInit }> = [];
  const manifest = { metadata: { name: 'Scanner' }, infra: {}, navigator: {}, screens: {} };

  globalThis.fetch = mock(async (input: string | URL | Request, init?: RequestInit) => {
    const url = String(input);
    requests.push({ url, init });
    if (url.endsWith('/projects/scanner/studio/manifest')) {
      return Response.json(manifest);
    }
    if (url.endsWith('/projects/scanner/studio/runtime')) {
      return Response.json({ success: true });
    }
    return Response.json({ error: 'Unexpected request' }, { status: 404 });
  }) as unknown as typeof fetch;

  await syncStudioRuntime('scanner', 'http://studio.test/api');

  expect(requests).toHaveLength(2);
  expect(requests[0]?.url).toEndWith('/projects/scanner/studio/manifest');
  expect(requests[1]?.url).toEndWith('/projects/scanner/studio/runtime');
  expect(requests[1]?.init?.method).toBe('PUT');
  expect(requests[1]?.init?.headers).toEqual({ 'Content-Type': 'application/json' });
  expect(requests[1]?.init?.body).toBe(JSON.stringify(manifest));
});

test('syncStudioRuntime surfaces host runtime errors', async () => {
  globalThis.fetch = mock(async (input: string | URL | Request) => {
    const url = String(input);
    if (url.endsWith('/studio/manifest')) {
      return Response.json({ metadata: {}, infra: {}, navigator: {}, screens: {} });
    }
    return Response.json(
      { error: 'OAuth is enabled but no provider is enabled.' },
      { status: 500 },
    );
  }) as unknown as typeof fetch;

  expect(syncStudioRuntime('scanner', 'http://studio.test/api')).rejects.toThrow(
    'OAuth is enabled but no provider is enabled.',
  );
});
