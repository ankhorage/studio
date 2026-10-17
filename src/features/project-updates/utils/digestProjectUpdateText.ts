import { createHash } from 'node:crypto';

/*** Compute the canonical SHA-256 digest used by APM reviewed text changes. */
export function digestProjectUpdateText(content: string): string {
  return createHash('sha256').update(content, 'utf8').digest('hex');
}
