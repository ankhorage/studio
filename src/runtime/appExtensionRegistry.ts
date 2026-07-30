import type { ComponentRegistry } from '@ankhorage/runtime';
import { ChessBoard, OpeningBook } from '@ankhorage/zora-chess';
import { TabletopTable } from '@ankhorage/zora-tabletop';

export const STUDIO_APP_EXTENSION_COMPONENT_REGISTRY: ComponentRegistry = {
  ChessBoard,
  OpeningBook,
  TabletopTable,
};

/**
 * Exact Studio-owned extension node types that accept and enforce interactionPolicy.
 *
 * Registry membership alone does not opt a component in.
 */
export const STUDIO_APP_EXTENSION_INTERACTION_POLICY_SUPPORT = {} as const;
