import type { ComponentRegistry } from '@ankhorage/runtime';
import { createComponentRegistry, ZORA_COMPONENT_REGISTRY } from '@ankhorage/runtime';

export interface StudioPreviewRegistryOptions {
  readonly components?: ComponentRegistry;
}

export const createStudioPreviewComponentRegistry = (
  options: StudioPreviewRegistryOptions = {},
): ComponentRegistry => createComponentRegistry(ZORA_COMPONENT_REGISTRY, options.components ?? {});

export const STUDIO_PREVIEW_COMPONENT_REGISTRY = createStudioPreviewComponentRegistry();
