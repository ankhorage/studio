import { afterEach, expect, mock, test } from 'bun:test';

import { syncProjectRuntime } from './studioRuntimeApi';

const originalFetch = globalThis.fetch;

afterEach(() => {
  globalThis.fetch = originalFetch;
});

test('syncProjectRuntime loads the persisted draft and applies it to the generated runtime', async () => {
  const requests: { url: string; init?: RequestInit }[] = [];
  const manifest = { metadata: { name: 'Scanner' }, infra: {}, navigator: {}, screens: {} };

  globalThis.fetch = mock((input: string | URL | Request, init?: RequestInit) => {
    const url = requestUrl(input);
    requests.push({ url, init });
    if (url.endsWith('/projects/scanner/manifest')) {
      return Promise.resolve(Response.json(manifest));
    }
    if (url.endsWith('/projects/scanner/runtime/sync')) {
      return Promise.resolve(Response.json({ success: true }));
    }
    return Promise.resolve(Response.json({ error: 'Unexpected request' }, { status: 404 }));
  }) as unknown as typeof fetch;

  await syncProjectRuntime('scanner', 'http://studio.test/api');

  expect(requests).toHaveLength(2);
  expect(requests[0]?.url).toEndWith('/projects/scanner/manifest');
  expect(requests[1]?.url).toEndWith('/projects/scanner/runtime/sync');
  expect(requests[1]?.init?.method).toBe('PUT');
  expect(requests[1]?.init?.headers).toEqual({ 'Content-Type': 'application/json' });
  expect(requests[1]?.init?.body).toBe(JSON.stringify(manifest));
});

test('syncProjectRuntime surfaces host runtime errors', async () => {
  globalThis.fetch = mock((input: string | URL | Request) => {
    const url = requestUrl(input);
    if (url.endsWith('/manifest')) {
      return Promise.resolve(
        Response.json({ metadata: {}, infra: {}, navigator: {}, screens: {} }),
      );
    }
    return Promise.resolve(
      Response.json({ error: 'OAuth is enabled but no provider is enabled.' }, { status: 500 }),
    );
  }) as unknown as typeof fetch;

  const error = await captureError(() => syncProjectRuntime('scanner', 'http://studio.test/api'));
  expect(error.message).toBe('OAuth is enabled but no provider is enabled.');
});

function requestUrl(input: string | URL | Request): string {
  if (typeof input === 'string') return input;
  if (input instanceof URL) return input.toString();
  return input.url;
}

async function captureError(action: () => Promise<void>): Promise<Error> {
  try {
    await action();
  } catch (error) {
    if (error instanceof Error) return error;
    throw error;
  }
  throw new Error('Expected action to reject.');
}
