import { parseSemanticVersion } from '@ankhorage/utility/semver';

/*** Return the exact semantic-version floor represented by Studio-managed exact/caret/tilde ranges. */
export function readManagedPackageRangeFloor(range: string): string | undefined {
  const exact = range.startsWith('^') || range.startsWith('~') ? range.slice(1) : range;
  return parseSemanticVersion(exact) === null ? undefined : exact;
}
