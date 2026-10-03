import type { ApmProjectionHandler } from '@ankhorage/apm/types';

import { STUDIO_GENERATED_PACKAGE_POLICY_PROJECTION_ID } from '../../constants';
import { studioUpdateExtension } from '../inbound/studioUpdateExtension';

/*** Resolve the generated package-policy runtime handler from the current Studio artifact. */
export function readStudioGeneratedPackagePolicyHandler(): ApmProjectionHandler {
  const handler = studioUpdateExtension.projections.find(
    ({ id }) => id === STUDIO_GENERATED_PACKAGE_POLICY_PROJECTION_ID,
  );
  if (handler === undefined) {
    throw new Error('Studio package-policy projection handler is missing.');
  }
  return handler;
}
