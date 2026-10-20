import { expect, test } from 'bun:test';

import { createStudioRuntimeCapabilityExecutor } from './executeStudioRuntimeCapabilityAsync';

test('executes an Expo alert and maps its successful result to Runtime 5 data', async () => {
  const messages: string[] = [];
  const executeCapability = createStudioRuntimeCapabilityExecutor({
    alert: (message) => messages.push(message),
  });

  expect(
    await executeCapability({ capability: 'expo.alert', input: { message: 'Saved' } }),
  ).toEqual({
    data: null,
    ok: true,
  });
  expect(messages).toEqual(['Saved']);
});

test('delegates navigation and theme mode through their published owner descriptors', async () => {
  const navigations: unknown[] = [];
  const modes: unknown[] = [];
  const executeCapability = createStudioRuntimeCapabilityExecutor({
    navigate: (input) => navigations.push(input),
    setThemeMode: (input) => modes.push(input),
  });

  expect(
    await executeCapability({
      capability: 'navigator.navigate',
      input: { params: { tab: 'settings' }, route: '/settings' },
    }),
  ).toEqual({ data: null, ok: true });
  expect(await executeCapability({ capability: 'theme.setMode', input: { mode: 'dark' } })).toEqual(
    {
      data: null,
      ok: true,
    },
  );

  expect(navigations).toEqual([{ params: { tab: 'settings' }, route: '/settings' }]);
  expect(modes).toEqual([{ mode: 'dark' }]);
});

test('preserves owner invalid-input diagnostics with Runtime severity', async () => {
  const executeCapability = createStudioRuntimeCapabilityExecutor({ alert: () => undefined });

  expect(await executeCapability({ capability: 'expo.alert', input: { message: 3 } })).toEqual({
    diagnostics: [
      {
        code: 'invalid-expo-alert-input',
        message:
          "The 'expo.alert' capability requires an input object with only a string 'message'.",
        severity: 'error',
      },
    ],
    ok: false,
  });
});

test('rejects missing Navigator routes before the host callback', async () => {
  const navigations: unknown[] = [];
  const executeCapability = createStudioRuntimeCapabilityExecutor({
    navigate: (input) => navigations.push(input),
  });

  expect(await executeCapability({ capability: 'navigator.navigate', input: {} })).toEqual({
    diagnostics: [
      {
        code: 'invalid-capability-input',
        message:
          "Capability 'navigator.navigate' received input that does not satisfy its published owner schema.",
        severity: 'error',
      },
    ],
    ok: false,
  });
  expect(navigations).toEqual([]);
});

test('rejects invalid Surface theme modes before the host callback', async () => {
  const modes: unknown[] = [];
  const executeCapability = createStudioRuntimeCapabilityExecutor({
    setThemeMode: (input) => modes.push(input),
  });

  expect(
    await executeCapability({ capability: 'theme.setMode', input: { mode: 'system' } }),
  ).toEqual({
    diagnostics: [
      {
        code: 'invalid-capability-input',
        message:
          "Capability 'theme.setMode' received input that does not satisfy its published owner schema.",
        severity: 'error',
      },
    ],
    ok: false,
  });
  expect(modes).toEqual([]);
});

test('reports a failing Navigator host callback without treating it as successful', async () => {
  const executeCapability = createStudioRuntimeCapabilityExecutor({
    navigate: () => {
      throw new Error('router is unavailable');
    },
  });

  expect(
    await executeCapability({ capability: 'navigator.navigate', input: { route: '/settings' } }),
  ).toEqual({
    diagnostics: [
      {
        code: 'capability-handler-failed',
        message: "The handler for 'navigator.navigate' failed: router is unavailable",
        severity: 'error',
      },
    ],
    ok: false,
  });
});

test('reports missing host handlers and unknown capabilities as Runtime failures', async () => {
  const executeCapability = createStudioRuntimeCapabilityExecutor({});

  expect(
    await executeCapability({ capability: 'navigator.navigate', input: { route: '/settings' } }),
  ).toEqual({
    diagnostics: [
      {
        code: 'missing-capability-handler',
        message: "No Expo Runtime capability handler is configured for 'navigator.navigate'.",
        severity: 'error',
      },
    ],
    ok: false,
  });
  expect(await executeCapability({ capability: 'missing.capability' })).toEqual({
    diagnostics: [
      {
        code: 'missing-operation',
        message: "Capability 'missing.capability' has no Studio runtime-host executor.",
        severity: 'error',
      },
    ],
    ok: false,
  });
});
