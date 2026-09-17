import { composeZoraPlugins, ZORA_CORE_PLUGIN } from '@ankhorage/zora';

import { STUDIO_ZORA_EXTENSION_SOURCES } from '../constants';

/*** Compose the exact ZORA core/plugin set installed by the Studio runtime edge. */
export const STUDIO_ZORA_PLUGIN_CATALOG = composeZoraPlugins([
  ZORA_CORE_PLUGIN,
  ...STUDIO_ZORA_EXTENSION_SOURCES.map(({ plugin }) => plugin),
]);
