import type { ComponentRegistry } from '@ankhorage/runtime';
import { ChessBoard, OpeningBook } from '@ankhorage/zora-chess';
import { TabletopTable } from '@ankhorage/zora-tabletop';

/***
 * Register Studio-specific application extension components for runtime rendering.
 * @todo Move this concrete Studio extension composition out of generic `runtime/` and into the Studio app/runtime edge; the component packages remain the implementation owners.
 */
export const STUDIO_APP_EXTENSION_COMPONENT_REGISTRY: ComponentRegistry = {
  ChessBoard,
  OpeningBook,
  TabletopTable,
};

/***
 * Declare the exact Studio-owned extension node types that accept and enforce interactionPolicy; registry membership alone does not opt a component in.
 * @todo Keep this Studio extension capability policy beside the app-extension composition owner rather than in generic `runtime/`.
 */
export const STUDIO_APP_EXTENSION_INTERACTION_POLICY_SUPPORT = {} as const;
