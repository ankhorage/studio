import { composeZoraPlugins, ZORA_CORE_PLUGIN } from '@ankhorage/zora';
import { ZORA_CHESS_PLUGIN } from '@ankhorage/zora-chess';
import { ZORA_TABLETOP_PLUGIN } from '@ankhorage/zora-tabletop';

/*** Compose the exact ZORA core/plugin set installed by the Studio runtime edge. */
export const STUDIO_ZORA_PLUGIN_CATALOG = composeZoraPlugins([
  ZORA_CORE_PLUGIN,
  ZORA_CHESS_PLUGIN,
  ZORA_TABLETOP_PLUGIN,
]);
