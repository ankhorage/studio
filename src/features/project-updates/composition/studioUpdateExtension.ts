import { createHash } from 'node:crypto';

import type { ApmUpdateExtension } from '@ankhorage/apm/types';

import { getGeneratedPackagePolicy } from '../adapters/outbound/getGeneratedPackagePolicy.js';
import { getStudioUpdateDescriptorDigest } from '../adapters/outbound/getStudioUpdateDescriptorDigest.js';
import { createGeneratedPackagePolicyProjection } from '../application/createGeneratedPackagePolicyProjection.js';

/*** Expose the headless Studio owner through its native Node/Bun ESM package boundary.
 * Studio package policy is bound to the selected target artifact, never the older running host.
 * Inspection and planning only read project files; malformed inputs cannot produce an empty success plan.
 * Writes use reviewed mutation IDs sequentially and stop immediately on failure. APM owns locking,
 * snapshot validation and recovery; this extension neither installs packages nor ships an application.
 * Releases use the published Devtools APM gate after versioning and owner transition tests; the exact
 * validated archive is published without running lifecycle scripts or packing a second time.
 * @readme
 */
export const studioUpdateExtension: ApmUpdateExtension = createExtension();

/*** Compose one immutable descriptor identity and its artifact-owned package-policy handler. */
function createExtension(): ApmUpdateExtension {
  const descriptorDigest = getStudioUpdateDescriptorDigest();
  return {
    protocolVersion: 1,
    descriptorDigest,
    migrations: [],
    projections: [
      createGeneratedPackagePolicyProjection({
        policy: getGeneratedPackagePolicy(),
        descriptorDigest,
        digest: (value) => createHash('sha256').update(value).digest('hex'),
      }),
    ],
  };
}
