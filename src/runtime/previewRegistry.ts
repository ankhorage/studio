import { type ComponentRegistry, createComponentRegistry } from '@ankhorage/runtime';
import { ZORA_COMPONENT_REGISTRY } from '@ankhorage/zora';

import { STUDIO_APP_EXTENSION_COMPONENT_REGISTRY } from './appExtensionRegistry.js';

export interface StudioPreviewRegistryOptions {
  readonly components?: ComponentRegistry;
}

export const createStudioPreviewComponentRegistry = (
  options: StudioPreviewRegistryOptions = {},
): ComponentRegistry =>
  createComponentRegistry(
    ZORA_COMPONENT_REGISTRY,
    STUDIO_APP_EXTENSION_COMPONENT_REGISTRY,
    options.components ?? {},
  );

export const STUDIO_PREVIEW_COMPONENT_REGISTRY = createStudioPreviewComponentRegistry();
