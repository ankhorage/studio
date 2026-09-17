import type { ZoraPluginMetadata } from '@ankhorage/zora';
import { ZORA_PLUGIN_METADATA as ZORA_CHESS_PLUGIN_METADATA } from '@ankhorage/zora-chess/metadata';
import { ZORA_PLUGIN_METADATA as ZORA_TABLETOP_PLUGIN_METADATA } from '@ankhorage/zora-tabletop/metadata';

/*** Define the exact metadata-only ZORA extension sources installed by this Studio artifact. */
export const STUDIO_ZORA_EXTENSION_SOURCES = [
  { descriptorExportName: 'ZORA_CHESS_PLUGIN', metadata: ZORA_CHESS_PLUGIN_METADATA },
  { descriptorExportName: 'ZORA_TABLETOP_PLUGIN', metadata: ZORA_TABLETOP_PLUGIN_METADATA },
] as const satisfies readonly {
  readonly descriptorExportName: string;
  readonly metadata: ZoraPluginMetadata;
}[];
