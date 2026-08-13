import {
  createExpoBundledMediaResolver,
  type ExpoBundledMediaRegistry,
} from '@ankhorage/expo-runtime/bundled-media';
import {
  type RuntimeMediaAssetResolver,
  type RuntimeRendererConfig,
  RuntimeRendererConfigProvider,
} from '@ankhorage/runtime';
import React, { useMemo } from 'react';

import { API_BASE } from '../core/constants';
import { useStudio } from '../core/StudioContext';
import { createStudioMediaAssetResolver } from '../runtime/studioMediaResolver';

export interface AnkhStudioProps {
  children: React.ReactNode;
  runtimeRegistry?: unknown;
  runtimeConfig?: unknown;
  bundledMediaRegistry?: ExpoBundledMediaRegistry;
}

export const AnkhStudio = ({ children, bundledMediaRegistry = {} }: AnkhStudioProps) => {
  const studio = useStudio();
  const resolveMediaAsset = useMemo<RuntimeMediaAssetResolver>(() => {
    const bundledResolver = createExpoBundledMediaResolver(bundledMediaRegistry);
    const storageResolver = createStudioMediaAssetResolver({
      apiBase: API_BASE,
      projectId: studio.projectId,
    });
    return async (args) => bundledResolver(args) ?? (await storageResolver(args));
  }, [bundledMediaRegistry, studio.projectId]);
  const mediaConfig = useMemo<RuntimeRendererConfig>(
    () => ({ mediaAssets: studio.manifest?.media?.assets, resolveMediaAsset }),
    [resolveMediaAsset, studio.manifest?.media?.assets],
  );

  if (studio.error) return React.createElement(React.Fragment, null, studio.error);
  if (studio.isLoading || !studio.manifest) return null;

  return React.createElement(RuntimeRendererConfigProvider, { value: mediaConfig, children });
};
