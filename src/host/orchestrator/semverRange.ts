interface SemanticVersion {
  readonly major: number;
  readonly minor: number;
  readonly patch: number;
}

/***
 * Parse an exact three-part semantic version without prerelease/build metadata.
 * @utility @ankhorage/utility/semver
 */
function parseSemanticVersion(value: string): SemanticVersion | null {
  const match = /^(\d+)\.(\d+)\.(\d+)$/u.exec(value);
  if (!match) {
    return null;
  }

  return {
    major: Number(match[1]),
    minor: Number(match[2]),
    patch: Number(match[3]),
  };
}

/***
 * Compare semantic versions by major, minor, then patch.
 * @utility @ankhorage/utility/semver
 */
function compareSemanticVersions(left: SemanticVersion, right: SemanticVersion): number {
  return left.major - right.major || left.minor - right.minor || left.patch - right.patch;
}

/***
 * Return whether an exact semantic version satisfies an exact three-part caret range.
 * @utility @ankhorage/utility/semver
 */
export function satisfiesCaretSemverRange(version: string, range: string): boolean {
  if (!range.startsWith('^')) {
    return false;
  }

  const candidate = parseSemanticVersion(version);
  const minimum = parseSemanticVersion(range.slice(1));
  if (!candidate || !minimum || compareSemanticVersions(candidate, minimum) < 0) {
    return false;
  }

  const upperBound =
    minimum.major > 0
      ? { major: minimum.major + 1, minor: 0, patch: 0 }
      : minimum.minor > 0
        ? { major: 0, minor: minimum.minor + 1, patch: 0 }
        : { major: 0, minor: 0, patch: minimum.patch + 1 };

  return compareSemanticVersions(candidate, upperBound) < 0;
}
