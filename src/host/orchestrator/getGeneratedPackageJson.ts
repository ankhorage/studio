import { applyGeneratedPackagePolicy } from './applyGeneratedPackagePolicy';
import { getPackageJson } from './templates';

/*** Build one generated app package manifest with owner-managed dependency ranges applied. */
export function getGeneratedPackageJson(
  args: Parameters<typeof getPackageJson>[0],
): ReturnType<typeof getPackageJson> {
  return applyGeneratedPackagePolicy(getPackageJson(args));
}
