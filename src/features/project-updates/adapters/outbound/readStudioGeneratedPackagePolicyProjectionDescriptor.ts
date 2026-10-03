import type { ApmProjectionDescriptor } from '@ankhorage/apm/types';

import { STUDIO_GENERATED_PACKAGE_POLICY_PROJECTION_ID } from '../../constants';
import { readStudioGeneratedPackagePolicyDescriptor } from './readStudioGeneratedPackagePolicyDescriptor';

/*** Resolve the generated package-policy projection descriptor from validated Studio metadata. */
export function readStudioGeneratedPackagePolicyProjectionDescriptor(): ApmProjectionDescriptor {
  const projection = readStudioGeneratedPackagePolicyDescriptor().projections.find(
    ({ id }) => id === STUDIO_GENERATED_PACKAGE_POLICY_PROJECTION_ID,
  );
  if (projection === undefined) throw new Error('Studio package-policy projection is missing.');
  return projection;
}
