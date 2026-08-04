import { expect, test } from 'bun:test';

import type { useStudioUnsupportedNodeMeasurement } from './index';

test('exports the established unsupported-node measurement hook', () => {
  type UnsupportedMeasurementHook = typeof useStudioUnsupportedNodeMeasurement;
  const publicContractExists: UnsupportedMeasurementHook extends (...args: never[]) => unknown
    ? true
    : false = true;

  expect(publicContractExists).toBe(true);
});
