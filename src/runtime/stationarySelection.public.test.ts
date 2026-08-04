import { expect, test } from 'bun:test';

import type { useStudioRuntimeNodeMeasurement, useStudioUnsupportedNodeMeasurement } from './index';

test('exports the canonical Runtime measurement hook and compatibility alias', () => {
  type RuntimeHook = typeof useStudioRuntimeNodeMeasurement;
  type CompatibilityHook = typeof useStudioUnsupportedNodeMeasurement;
  const publicContractIsCompatible: RuntimeHook extends CompatibilityHook ? true : false = true;

  expect(publicContractIsCompatible).toBe(true);
});
