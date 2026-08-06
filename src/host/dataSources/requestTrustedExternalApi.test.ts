import { describe, expect, test } from 'bun:test';

import { requestTrustedExternalApi } from './requestTrustedExternalApi';

async function readBlockedMessage(url: string): Promise<string> {
  try {
    await requestTrustedExternalApi(url, { method: 'GET', headers: {} });
    return '';
  } catch (error) {
    return error instanceof Error ? error.message : String(error);
  }
}

describe('trusted external API transport', () => {
  test('blocks cloud metadata targets before network access', async () => {
    expect(await readBlockedMessage('http://169.254.169.254/latest/meta-data')).toContain(
      'blocked by the trusted transport policy',
    );
  });

  test('blocks inline URL credentials', async () => {
    expect(await readBlockedMessage('https://user:secret@example.com/openapi.json')).toContain(
      'blocked by the trusted transport policy',
    );
  });
});
