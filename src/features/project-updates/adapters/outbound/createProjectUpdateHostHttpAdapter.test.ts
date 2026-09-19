import { afterEach, expect, mock, test } from 'bun:test';

import { createProjectUpdateHostHttpAdapter } from './createProjectUpdateHostHttpAdapter';

const originalFetch = globalThis.fetch;

afterEach(() => {
  globalThis.fetch = originalFetch;
});

test('returns structured APM plan conflicts for dashboard review', async () => {
  const conflict = {
    schemaVersion: 2,
    operation: 'plan',
    complete: false,
    blockers: [
      {
        code: 'plan.host-upgrade-required',
        reason: 'Restart Studio before applying this plan.',
      },
    ],
  };

  globalThis.fetch = mock(() =>
    Promise.resolve(Response.json(conflict, { status: 409 })),
  ) as unknown as typeof fetch;

  const host = createProjectUpdateHostHttpAdapter('http://studio.test/api');
  const result = await host.planAsync('example', {
    availability: 'refresh',
    policy: {
      dependencyUpdates: 'safe',
      repairInstallations: true,
      repairProjections: true,
    },
  });

  expect(result).toEqual(conflict);
});

test('rejects unrelated conflict payloads as transport failures', () => {
  globalThis.fetch = mock(() =>
    Promise.resolve(Response.json({ error: 'Project root is unavailable.' }, { status: 409 })),
  ) as unknown as typeof fetch;

  const host = createProjectUpdateHostHttpAdapter('http://studio.test/api');

  expect(
    host.planAsync('example', {
      availability: 'refresh',
      policy: {
        dependencyUpdates: 'safe',
        repairInstallations: true,
        repairProjections: true,
      },
    }),
  ).rejects.toThrow('Project root is unavailable.');
});
