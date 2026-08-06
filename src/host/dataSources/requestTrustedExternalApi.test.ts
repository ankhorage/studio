import { describe, expect, test } from 'bun:test';

import { requestTrustedExternalApi } from './requestTrustedExternalApi';

describe('trusted external API transport', () => {
  test('blocks cloud metadata targets before network access', async () => {
    await expect(
      requestTrustedExternalApi('http://169.254.169.254/latest/meta-data', {
        method: 'GET',
        headers: {},
      }),
    ).rejects.toThrow('blocked by the trusted transport policy');
  });

  test('blocks inline URL credentials', async () => {
    await expect(
      requestTrustedExternalApi('https://user:secret@example.com/openapi.json', {
        method: 'GET',
        headers: {},
      }),
    ).rejects.toThrow('blocked by the trusted transport policy');
  });
});
