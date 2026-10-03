import { readFileSync } from 'node:fs';

import { validateUpdateDescriptor } from '@ankhorage/apm';
import type { ApmUpdateDescriptor } from '@ankhorage/apm/types';

import { STUDIO_PACKAGE_NAME } from '../../constants';
import { getGeneratedPackagePolicy } from './getGeneratedPackagePolicy';

const DESCRIPTOR_URL = new URL('../../../../../apm/update.json', import.meta.url);

/*** Read and validate the immutable Studio update descriptor shipped with this package artifact. */
export function readStudioGeneratedPackagePolicyDescriptor(): ApmUpdateDescriptor {
  const descriptor: unknown = JSON.parse(readFileSync(DESCRIPTOR_URL, 'utf8'));
  const validation = validateUpdateDescriptor({
    descriptor,
    expectedOwner: {
      name: STUDIO_PACKAGE_NAME,
      version: getGeneratedPackagePolicy().ownerVersion,
    },
  });
  if (!validation.valid || validation.descriptor === undefined) {
    throw new Error('Studio APM update descriptor is invalid for the running package artifact.');
  }
  return validation.descriptor;
}
