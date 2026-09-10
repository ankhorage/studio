import { applyGeneratedPackagePolicy } from './applyGeneratedPackagePolicy';
import { getPackageJson as getBasePackageJson } from './templateSources';

export type { GeneratedAuthProvider, GeneratedStorageProvider } from './templateSources';
export {
  getAndroidRunTs,
  getAppConfigTs,
  getEasJson,
  getMetroConfigJs,
  getMetroEmptyModuleJs,
  getTsConfigJson,
} from './templateSources';

/*** Generate one app package manifest with current owner-managed dependency policy applied. */
export function getPackageJson(args: Parameters<typeof getBasePackageJson>[0]) {
  return applyGeneratedPackagePolicy(getBasePackageJson(args));
}
