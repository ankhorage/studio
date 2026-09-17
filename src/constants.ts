import type { ZoraPluginDescriptor } from '@ankhorage/zora';
import { ZORA_CHESS_PLUGIN } from '@ankhorage/zora-chess';
import { ZORA_TABLETOP_PLUGIN } from '@ankhorage/zora-tabletop';

/*** Define the exact released ZORA plugin descriptors installed by this Studio artifact. */
export const STUDIO_ZORA_EXTENSION_SOURCES = [
  { descriptorExportName: 'ZORA_CHESS_PLUGIN', plugin: ZORA_CHESS_PLUGIN },
  { descriptorExportName: 'ZORA_TABLETOP_PLUGIN', plugin: ZORA_TABLETOP_PLUGIN },
] as const satisfies readonly {
  readonly descriptorExportName: string;
  readonly plugin: ZoraPluginDescriptor;
}[];
