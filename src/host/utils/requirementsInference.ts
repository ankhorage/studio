import {
  ANKHORAGE_CAPABILITY_NAMES,
  ANKHORAGE_PERMISSION_NAMES,
  type AnkhorageCapabilityName,
  type AnkhoragePermissionName,
  type ScreenRequirements,
  type UiNode,
} from '@ankhorage/contracts';
import { readOwnProperty, setOwnProperty } from '@ankhorage/utility/object';
import { ZORA_COMPONENT_META } from '@ankhorage/zora/metadata';

/***
 * Infer screen permission/capability requirements by walking authored UiNodes and collecting
 * membership declared by ZORA component metadata.
 * @todo Move this requirements-domain behavior out of generic `host/utils`; it depends directly
 * on shared ScreenRequirements contracts and ZORA metadata and should live with the owning
 * generation/requirements capability.
 */
export function inferScreenRequirementsFromUi(root: UiNode): ScreenRequirements | undefined {
  const permissions: Partial<Record<AnkhoragePermissionName, true>> = {};
  const capabilities: Partial<Record<AnkhorageCapabilityName, true>> = {};

  /*** Visit one UiNode subtree and collect metadata-declared requirement membership. */
  function walk(node: UiNode) {
    const meta = ZORA_COMPONENT_META[node.type];

    if (meta?.requirements) {
      for (const permission of ANKHORAGE_PERMISSION_NAMES) {
        if (readOwnProperty(meta.requirements.permissions ?? {}, permission) === true) {
          setOwnProperty(permissions, permission, true);
        }
      }
      for (const capability of ANKHORAGE_CAPABILITY_NAMES) {
        if (readOwnProperty(meta.requirements.capabilities ?? {}, capability) === true) {
          setOwnProperty(capabilities, capability, true);
        }
      }
    }

    node.children?.forEach(walk);
  }

  walk(root);
  return createRequirements(permissions, capabilities);
}

/***
 * Merge inferred and explicit ScreenRequirements membership, with explicit membership retained.
 * @todo This is reusable requirements-domain behavior, but the correct owner is the
 * ScreenRequirements/contracts capability rather than generic Utility.
 */
export function mergeScreenRequirements(
  explicit?: ScreenRequirements,
  inferred?: ScreenRequirements,
): ScreenRequirements | undefined {
  if (!explicit && !inferred) return undefined;

  return createRequirements(
    { ...(inferred?.permissions ?? {}), ...(explicit?.permissions ?? {}) },
    { ...(inferred?.capabilities ?? {}), ...(explicit?.capabilities ?? {}) },
  );
}

/*** Omit empty requirement sets so manifests contain only meaningful runtime requirements. */
function createRequirements(
  permissions: Partial<Record<AnkhoragePermissionName, true>>,
  capabilities: Partial<Record<AnkhorageCapabilityName, true>>,
): ScreenRequirements | undefined {
  if (Object.keys(permissions).length === 0 && Object.keys(capabilities).length === 0) {
    return undefined;
  }

  return {
    permissions: Object.keys(permissions).length > 0 ? permissions : undefined,
    capabilities: Object.keys(capabilities).length > 0 ? capabilities : undefined,
  };
}
