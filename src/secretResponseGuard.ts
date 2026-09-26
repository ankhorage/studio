import { assertNoNestedKeys, findNestedKey, type NestedKeyMatch } from '@ankhorage/utility/object';

export const RAW_SECRET_RESPONSE_KEYS = [
  'clientSecret',
  'payload',
  'privateKey',
  'rawValue',
  'secret',
  'token',
  'value',
] as const;

const RAW_SECRET_RESPONSE_KEY_SET = new Set<string>(RAW_SECRET_RESPONSE_KEYS);

export type RawSecretResponseKeyMatch = NestedKeyMatch;

/***
 * Find the first raw-secret-shaped key anywhere in an unknown response value.
 */
export function findRawSecretResponseKey(value: unknown): RawSecretResponseKeyMatch | null {
  return findNestedKey(value, RAW_SECRET_RESPONSE_KEY_SET);
}

/***
 * Reject a response that contains raw-secret-shaped keys instead of metadata-only values.
 */
export function assertMetadataOnlyResponse(value: unknown, message: string): void {
  assertNoNestedKeys(
    value,
    RAW_SECRET_RESPONSE_KEY_SET,
    (match) => `${message} Raw secret-shaped response field "${match.key}" at ${match.path}.`,
  );
}
