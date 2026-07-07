import {
  createComponentRegistry,
  type ComponentRegistry,
  ZORA_COMPONENT_REGISTRY as BASE_ZORA_COMPONENT_REGISTRY,
} from '@ankhorage/runtime';

import { APP_EXTENSION_COMPONENT_REGISTRY } from './appExtensionRegistry.js';

export { APP_EXTENSION_COMPONENT_REGISTRY } from './appExtensionRegistry.js';
export { createComponentRegistry, SURFACE_COMPONENT_REGISTRY } from '@ankhorage/runtime';
export type { ComponentRegistry } from '@ankhorage/runtime';

export const ZORA_COMPONENT_REGISTRY: ComponentRegistry = createComponentRegistry(
  BASE_ZORA_COMPONENT_REGISTRY,
  APP_EXTENSION_COMPONENT_REGISTRY,
);

export { ZORA_COMPONENT_REGISTRY as DEFAULT_COMPONENT_REGISTRY };
