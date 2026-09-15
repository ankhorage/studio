import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';

import { resolveNpmExtensionArtifactIdentityAsync } from '@ankhorage/apm/node';
import type { ApmExtensionArtifactIdentityResolution } from '@ankhorage/apm/types';

import { getGeneratedPackagePolicy } from './getGeneratedPackagePolicy';

const STUDIO_PACKAGE_NAME = '@ankhorage/studio';
const UPDATE_DESCRIPTOR_URL = new URL('../../../../../apm/update.json', import.meta.url);

/*** Resolve this installed Studio version to its immutable published npm artifact identity. */
export async function resolveCurrentStudioApmArtifactAsync(
  rootPath: string,
): Promise<ApmExtensionArtifactIdentityResolution> {
  const descriptorSource = await readFile(UPDATE_DESCRIPTOR_URL, 'utf8');
  return resolveNpmExtensionArtifactIdentityAsync({
    rootPath,
    role: 'target',
    packageName: STUDIO_PACKAGE_NAME,
    version: getGeneratedPackagePolicy().ownerVersion,
    descriptorDigest: createHash('sha256').update(descriptorSource, 'utf8').digest('hex'),
  });
}
