import { afterEach, expect, mock, test } from 'bun:test';

import { syncProjectRuntime } from './studioRuntimeApi';

const originalFetch = globalThis.fetch;

afterEach(() => {
  globalThis.fetch = originalFetch;
});

test('syncProjectRuntime asks the host to sync from canonical persisted state', async () => {
  const requests: { url: string; init?: RequestInit }[] = [];

  globalThis.fetch = mock((input: string | URL | Request, init?: RequestInit) => {
    requests.push({ url: requestUrl(input), init });
    return Promise.resolve(Response.json({ success: true }));
  }) as unknown as typeof fetch;

  await syncProjectRuntime('scanner', 'http://studio.test/api');

  expect(requests).toHaveLength(1);
  expect(requests[0]?.url).toEndWith('/projects/scanner/runtime/sync');
  expect(requests[0]?.init?.method).toBe('POST');
  expect(requests[0]?.init?.body).toBeUndefined();
});

test('syncProjectRuntime surfaces host runtime errors', async () => {
  globalThis.fetch = mock(() =>
    Promise.resolve(
      Response.json({ error: 'OAuth is enabled but no provider is enabled.' }, { status: 500 }),
    ),
  ) as unknown as typeof fetch;

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
