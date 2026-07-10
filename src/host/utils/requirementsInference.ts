import type {
  AnkhorageCapabilityName,
  AnkhoragePermissionName,
  ScreenCapabilityRequirement,
  ScreenPermissionRequirement,
  ScreenRequirements,
  UiNode,
} from '@ankhorage/contracts';
import { ZORA_COMPONENT_META } from '@ankhorage/zora/metadata';

export function inferScreenRequirementsFromUi(root: UiNode): ScreenRequirements | undefined {
  const permissions = new Map<AnkhoragePermissionName, ScreenPermissionRequirement>();
  const capabilities = new Map<AnkhorageCapabilityName, ScreenCapabilityRequirement>();

  function walk(node: UiNode) {
    const meta = ZORA_COMPONENT_META[node.type];

    if (meta?.requirements) {
      meta.requirements.permissions?.forEach((p) => {
        permissions.set(p.permission, p);
      });
      meta.requirements.capabilities?.forEach((c) => {
        capabilities.set(c.capability, c);
      });
    }

    if (node.children) {
      node.children.forEach(walk);
    }
  }

  walk(root);

  if (permissions.size === 0 && capabilities.size === 0) {
    return undefined;
  }

  return {
    permissions: permissions.size > 0 ? Array.from(permissions.values()) : undefined,
    capabilities: capabilities.size > 0 ? Array.from(capabilities.values()) : undefined,
  };
}

export function mergeScreenRequirements(
  explicit?: ScreenRequirements,
  inferred?: ScreenRequirements,
): ScreenRequirements | undefined {
  if (!explicit && !inferred) {
    return undefined;
  }

  const permissions = new Map<AnkhoragePermissionName, ScreenPermissionRequirement>();
  const capabilities = new Map<AnkhorageCapabilityName, ScreenCapabilityRequirement>();

  // Apply inferred first, then explicit to ensure explicit overrides
  [inferred?.permissions, explicit?.permissions].forEach((perms) => {
    perms?.forEach((p) => permissions.set(p.permission, p));
  });

  [inferred?.capabilities, explicit?.capabilities].forEach((caps) => {
    caps?.forEach((c) => capabilities.set(c.capability, c));
  });

  if (permissions.size === 0 && capabilities.size === 0) {
    return undefined;
  }

  return {
    permissions: permissions.size > 0 ? Array.from(permissions.values()) : undefined,
    capabilities: capabilities.size > 0 ? Array.from(capabilities.values()) : undefined,
  };
}
