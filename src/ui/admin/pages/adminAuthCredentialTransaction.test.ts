import { describe, expect, test } from 'bun:test';

import { OAuthCredentialTransactionCoordinator } from './adminAuthCredentialTransaction';

function createDeferred<T>(): {
  readonly promise: Promise<T>;
  readonly resolve: (value: T) => void;
} {
  let resolvePromise: ((value: T) => void) | null = null;
  const promise = new Promise<T>((resolve) => {
    resolvePromise = resolve;
  });

  return {
    promise,
    resolve: (value) => {
      resolvePromise?.(value);
    },
  };
}

describe('OAuthCredentialTransactionCoordinator', () => {
  test('same provider operations cannot overlap while manifest flush is pending', async () => {
    const coordinator = new OAuthCredentialTransactionCoordinator();
    const flush = createDeferred<void>();

    const first = coordinator.run('google', async () => {
      await flush.promise;
      return 'first';
    });

    expect(coordinator.isBusy('google')).toBe(true);
    const second = await coordinator.run('google', () => Promise.resolve('second'));
    expect(second).toEqual({ ok: false, reason: 'provider_busy' });

    flush.resolve();
    expect(await first).toEqual({ ok: true, value: 'first' });
    expect(coordinator.isBusy('google')).toBe(false);
  });

  test('provider remains busy through secret write, manifest link, flush, and health refresh', async () => {
    const coordinator = new OAuthCredentialTransactionCoordinator();
    const events: string[] = [];

    const result = await coordinator.run('google', async () => {
      events.push('secret-write');
      expect(coordinator.isBusy('google')).toBe(true);
      await Promise.resolve();

      events.push('manifest-link');
      expect(coordinator.isBusy('google')).toBe(true);
      await Promise.resolve();

      events.push('manifest-flush');
      expect(coordinator.isBusy('google')).toBe(true);
      await Promise.resolve();

      events.push('health-refresh');
      expect(coordinator.isBusy('google')).toBe(true);
      return 'complete';
    });

    expect(result).toEqual({ ok: true, value: 'complete' });
    expect(events).toEqual(['secret-write', 'manifest-link', 'manifest-flush', 'health-refresh']);
    expect(coordinator.isBusy('google')).toBe(false);
  });

  test('different providers do not block each other', async () => {
    const coordinator = new OAuthCredentialTransactionCoordinator();
    const googleFlush = createDeferred<void>();

    const google = coordinator.run('google', async () => {
      await googleFlush.promise;
      return 'google';
    });
    const github = await coordinator.run('github', () => Promise.resolve('github'));

    expect(github).toEqual({ ok: true, value: 'github' });
    expect(coordinator.isBusy('google')).toBe(true);
    expect(coordinator.isBusy('github')).toBe(false);

    googleFlush.resolve();
    expect(await google).toEqual({ ok: true, value: 'google' });
  });

  test('retry is serialized for the same provider without a second secret operation', async () => {
    const coordinator = new OAuthCredentialTransactionCoordinator();
    const flush = createDeferred<void>();
    let secretWrites = 1;
    let retryManifestLinks = 0;

    const retry = coordinator.run('google', async () => {
      retryManifestLinks += 1;
      await flush.promise;
      return 'retry';
    });

    const overlappingRetry = await coordinator.run('google', async () => {
      secretWrites += 1;
      retryManifestLinks += 1;
      await Promise.resolve();
      return 'overlapping';
    });

    expect(overlappingRetry).toEqual({ ok: false, reason: 'provider_busy' });
    expect(secretWrites).toBe(1);
    expect(retryManifestLinks).toBe(1);

    flush.resolve();
    expect(await retry).toEqual({ ok: true, value: 'retry' });
  });
});
