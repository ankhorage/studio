import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';

/*** Bind the executable Studio owner to the exact static descriptor bytes in its package artifact. */
export function getStudioUpdateDescriptorDigest(): string {
  const descriptorUrl = new URL('../../../../../apm/update.json', import.meta.url);
  return createHash('sha256').update(readFileSync(descriptorUrl)).digest('hex');
}
