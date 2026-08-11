import { describe, expect, test } from 'bun:test';

import {
  executeHostModuleAdminRuntime,
  type HostModuleAdminRuntimeContext,
  resolveHostModuleAdminRuntime,
} from './adminRuntime';

describe('generic module admin runtime contract', () => {
  test('keeps operation names and payloads opaque to Studio', async () => {
    const calls: unknown[][] = [];
    const runtime = resolveHostModuleAdminRuntime({
      kind: 'module-admin-runtime',
      execute: (context: HostModuleAdminRuntimeContext, invocation: unknown) => {
        calls.push([context.projectRoot, invocation]);
        return Promise.resolve({ handled: true });
      },
    });
    expect(runtime).not.toBeNull();
    if (!runtime) throw new Error('Expected valid runtime.');

    const result = await executeHostModuleAdminRuntime({
      runtime,
      context: createContext(),
      request: {
        operation: '  domain.operation  ',
        input: { value: 42 },
        componentMeta: { ignoredByDispatcher: true },
      },
    });

    expect(result).toEqual({ handled: true });
    expect(calls).toEqual([
      ['/workspace/apps/example', { operation: 'domain.operation', input: { value: 42 } }],
    ]);
  });

  test('rejects malformed runtimes and empty operations', async () => {
    expect(resolveHostModuleAdminRuntime(null)).toBeNull();
    expect(resolveHostModuleAdminRuntime({ kind: 'module-admin-runtime' })).toBeNull();
    expect(resolveHostModuleAdminRuntime({ kind: 'other', execute: () => undefined })).toBeNull();

    const runtime = resolveHostModuleAdminRuntime({
      kind: 'module-admin-runtime',
      execute: () => Promise.resolve(null),
    });
    if (!runtime) throw new Error('Expected valid runtime.');

    let failure: unknown;
    try {
      await executeHostModuleAdminRuntime({
        runtime,
        context: createContext(),
        request: { operation: '   ' },
      });
    } catch (error) {
      failure = error;
    }
    expect(failure).toBeInstanceOf(Error);
    expect(failure instanceof Error ? failure.message : '').toContain('must not be empty');
  });
});

function createContext(): HostModuleAdminRuntimeContext {
  return {
    projectRoot: '/workspace/apps/example',
    readConfig: () => Promise.resolve({}),
    reconfigureConfig: () => Promise.resolve(),
    readAuthoringContext: () => Promise.resolve({ screens: [], componentMeta: {} }),
    mutateManifestField: () => Promise.resolve(),
  };
}
