import { afterEach, describe, expect, it, mock } from 'bun:test';

import { createStudioMediaAssetResolver } from './studioMediaResolver';

const originalFetch = globalThis.fetch;

afterEach(() => {
  globalThis.fetch = originalFetch;
});

describe('createStudioMediaAssetResolver', () => {
  it('resolves an authored file asset through the project media endpoint', async () => {
    const fetchMock = mock((_input: RequestInfo | URL, _init?: RequestInit) =>
      Promise.resolve(Response.json({ url: 'https://media.example.test/signed/reader.epub' })),
    );
    globalThis.fetch = fetchMock as unknown as typeof fetch;
    const resolveMediaAsset = createStudioMediaAssetResolver({
      apiBase: 'http://127.0.0.1:3000',
      projectId: 'reader project',
    });

    const resolved = await resolveMediaAsset({
      asset: {
        id: 'reader-epub',
        kind: 'file',
        name: 'Reader EPUB',
        contentType: 'application/epub+zip',
        source: { kind: 'storage', bucket: 'media', path: 'reader/book.epub' },
      },
    });

    expect(resolved).toBe('https://media.example.test/signed/reader.epub');
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock.mock.calls[0]?.[0]).toBe(
      'http://127.0.0.1:3000/projects/reader%20project/media/resolve',
    );
    expect(fetchMock.mock.calls[0]?.[1]).toMatchObject({
      body: JSON.stringify({
        source: { kind: 'storage', bucket: 'media', path: 'reader/book.epub' },
      }),
      method: 'POST',
    });
  });
});
