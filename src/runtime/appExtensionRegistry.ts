import type { ComponentRegistry } from '@ankhorage/runtime';
import { ChessBoard, OpeningBook } from '@ankhorage/zora-chess';
import { TabletopTable } from '@ankhorage/zora-tabletop';

export const STUDIO_APP_EXTENSION_COMPONENT_REGISTRY: ComponentRegistry = {
  ChessBoard,
  OpeningBook,
  TabletopTable,
};
