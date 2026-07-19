import { describe, expect, test } from 'bun:test';

import type { ProjectAuthHealth } from '../../../projectAuthHealth';
import { AuthHealthRefreshCoordinator } from './adminAuthHealthFlow';

function createHealth(status: ProjectAuthHealth['status']): ProjectAuthHealth {
  return {
    status,
    callbackUrls: { appCallbackRoute: '/auth/callback' },
    providers: [],
    diagnostics: [],
  };
}

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

describe('AuthHealthRefreshCoordinator', () => {
  test('applies explicit health refresh results', async () => {
    const coordinator = new AuthHealthRefreshCoordinator();
    const applied: ProjectAuthHealth[] = [];

    const result = await coordinator.refresh({
      loadHealth: () => Promise.resolve(createHealth('healthy')),
      onHealth: (health) => applied.push(health),
      onError: () => {
        throw new Error('health refresh should not fail');
      },
    });

    expect(result.applied).toBe(true);
    expect(applied.map((health) => health.status)).toEqual(['healthy']);
  });

  test('prevents an older overlapping health response from overwriting a newer result', async () => {
    const coordinator = new AuthHealthRefreshCoordinator();
    const older = createDeferred<ProjectAuthHealth>();
    const newer = createDeferred<ProjectAuthHealth>();
    const applied: ProjectAuthHealth['status'][] = [];

    const olderRefresh = coordinator.refresh({
      loadHealth: () => older.promise,
      onHealth: (health) => applied.push(health.status),
      onError: () => undefined,
    });
    const newerRefresh = coordinator.refresh({
      loadHealth: () => newer.promise,
      onHealth: (health) => applied.push(health.status),
      onError: () => undefined,
    });

    newer.resolve(createHealth('healthy'));
    await newerRefresh;
    older.resolve(createHealth('error'));
    const olderResult = await olderRefresh;

    expect(olderResult.applied).toBe(false);
    expect(applied).toEqual(['healthy']);
  });

  test('ignores stale errors from older overlapping health requests', async () => {
    const coordinator = new AuthHealthRefreshCoordinator();
    const older = Promise.reject(new Error('stale failure'));
    const appliedErrors: string[] = [];

    const olderRefresh = coordinator.refresh({
      loadHealth: () => older,
      onHealth: () => undefined,
      onError: (error) => {
        appliedErrors.push(error instanceof Error ? error.message : 'unknown');
      },
    });
    const newerRefresh = coordinator.refresh({
      loadHealth: () => Promise.resolve(createHealth('healthy')),
      onHealth: () => undefined,
      onError: () => undefined,
    });

    await newerRefresh;
    await olderRefresh;

    expect(appliedErrors).toEqual([]);
  });
});
