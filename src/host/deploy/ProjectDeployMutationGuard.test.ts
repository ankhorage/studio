import { expect, test } from 'bun:test';

import { ProjectDeployMutationGuard } from './ProjectDeployMutationGuard';

test('release mutation guard rejects concurrent mutation for one project and always releases', async () => {
  const guard = new ProjectDeployMutationGuard();
  let releaseFirst = (): void => {
    throw new Error('First guarded operation resolver was not initialized.');
  };
  const first = guard.run(
    'demo',
    () =>
      new Promise<void>((resolve) => {
        releaseFirst = resolve;
      }),
  );

  const error = await captureError(() => guard.run('demo', () => Promise.resolve()));
  expect(error.message).toBe('DEPLOY_RELEASE_MUTATION_IN_PROGRESS');
  await guard.run('other-project', () => Promise.resolve());

  releaseFirst();
  await first;
  await guard.run('demo', () => Promise.resolve());
});

async function captureError(action: () => Promise<unknown>): Promise<Error> {
  try {
    await action();
  } catch (error) {
    if (error instanceof Error) return error;
    return new Error(String(error), { cause: error });
  }
  throw new Error('Expected operation to fail.');
}
