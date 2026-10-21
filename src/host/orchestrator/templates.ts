import { applyCurrentGeneratedPackagePolicy } from '../../features/project-updates/composition/applyCurrentGeneratedPackagePolicy';
import { getPackageJson as getBasePackageJson } from './templateSources';

export type { GeneratedAuthProvider, GeneratedStorageProvider } from './templateSources';
export {
  getAndroidRunTs,
  getAppConfigTs,
  getEasJson,
  getMetroConfigJs,
  getMetroEmptyModuleJs,
  getPlatformCheckMjs,
  getTsConfigJson,
} from './templateSources';

/*** Generate one app package manifest with current owner-managed dependency policy applied. */
export function getPackageJson(args: Parameters<typeof getBasePackageJson>[0]) {
  return applyCurrentGeneratedPackagePolicy(getBasePackageJson(args));
}
