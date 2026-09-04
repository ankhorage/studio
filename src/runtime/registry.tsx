/***
 * @todo Remove this re-export-only shim. `src/runtime/index.ts` should export the real app-extension registry owner directly; intermediate files must not exist only to re-export another local module.
 */
export { STUDIO_APP_EXTENSION_COMPONENT_REGISTRY } from './appExtensionRegistry.js';
export type { ComponentRegistry } from '@ankhorage/runtime';
