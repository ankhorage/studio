import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';

import { resolveNpmExtensionArtifactIdentityAsync } from '@ankhorage/apm/node';
import type {
  ApmExtensionArtifactIdentity,
  ApmExtensionArtifactIdentityResolution,
} from '@ankhorage/apm/types';

import { getGeneratedPackagePolicy } from './getGeneratedPackagePolicy';

const STUDIO_PACKAGE_NAME = '@ankhorage/studio';
const UPDATE_DESCRIPTOR_URL = new URL('../../../../../apm/update.json', import.meta.url);

export interface CurrentStudioApmArtifactBinding {
  readonly packageName: typeof STUDIO_PACKAGE_NAME;
  readonly version: string;
  readonly descriptorDigest: string;
}

/*** Resolve this installed Studio version to its immutable published npm artifact identity. */
export async function resolveCurrentStudioApmArtifactAsync(
  rootPath: string,
): Promise<ApmExtensionArtifactIdentityResolution> {
  const binding = await readCurrentStudioApmArtifactBindingAsync();
  return resolveNpmExtensionArtifactIdentityAsync({
    rootPath,
    role: 'target',
    ...binding,
  });
}

/*** Read the exact package version and update-descriptor digest loaded by this Studio runtime. */
export async function readCurrentStudioApmArtifactBindingAsync(): Promise<CurrentStudioApmArtifactBinding> {
  const descriptorSource = await readFile(UPDATE_DESCRIPTOR_URL, 'utf8');
  return {
    packageName: STUDIO_PACKAGE_NAME,
    version: getGeneratedPackagePolicy().ownerVersion,
    descriptorDigest: createHash('sha256').update(descriptorSource, 'utf8').digest('hex'),
  };
}

/*** Test whether one reviewed owner artifact is executed by this exact loaded Studio package. */
export async function currentStudioApmArtifactMatchesAsync(
  artifact: ApmExtensionArtifactIdentity,
): Promise<boolean> {
  const binding = await readCurrentStudioApmArtifactBindingAsync();
  return (
    artifact.packageName === binding.packageName &&
    artifact.version === binding.version &&
    artifact.descriptorDigest === binding.descriptorDigest
  );
}
