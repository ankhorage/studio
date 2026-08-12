import { usePathname } from 'expo-router';
import React from 'react';

import { useStudio } from '../../core/StudioContext';
import type { StudioAdminRouteId, StudioContextValue } from '../../index';
import {
  resolveStudioBindingsNodeId,
  resolveStudioModuleId,
  resolveStudioPropertiesNodeId,
  resolveStudioScreenId,
  resolveStudioThemeRecipeName,
} from '../../studioAdminRouteModel';
import { ApisAdminPage, type ApisAdminRouteId } from './pages/ApisAdminPage';
import { AuthAdminPage, type AuthAdminPageProps } from './pages/AuthAdminPage';
import { BindingsAdminPage } from './pages/BindingsAdminPage';
import { MediaAdminPage } from './pages/MediaAdminPage';
import { ModuleDetailAdminPage } from './pages/ModuleDetailAdminPage';
import { ModulesAdminPage } from './pages/ModulesAdminPage';
import { OverviewAdminPage } from './pages/OverviewAdminPage';
import { PropertiesAdminPage } from './pages/PropertiesAdminPage';
import { ScreenDetailAdminPage } from './pages/ScreenDetailAdminPage';
import { ScreensAdminPage } from './pages/ScreensAdminPage';
import { SecretsAdminPage } from './pages/SecretsAdminPage';
import { ThemeAdminPage } from './pages/ThemeAdminPage';
import { ThemeColorsAdminPage } from './pages/ThemeColorsAdminPage';
import { ThemeNumericTokensAdminPage } from './pages/ThemeNumericTokensAdminPage';
import { ThemeRecipeAdminPage } from './pages/ThemeRecipeAdminPage';
import { ThemeTypographyAdminPage } from './pages/ThemeTypographyAdminPage';

export interface AnkhAdminPageProps {
  readonly routeId: StudioAdminRouteId;
}

interface AdminPageRenderContext {
  readonly pathname: string;
  readonly routeId: StudioAdminRouteId;
  readonly studio: StudioContextValue;
}

type AdminPageRenderer = (context: AdminPageRenderContext) => React.ReactElement;
type AuthAdminRouteId = AuthAdminPageProps['routeId'];

const ADMIN_PAGE_RENDERERS = {
  overview: () => <OverviewAdminPage />,
  screens: () => <ScreensAdminPage />,
  media: () => <MediaAdminPage />,
  'screen-detail': ({ pathname }) => (
    <ScreenDetailAdminPage screenId={resolveStudioScreenId(pathname)} />
  ),
  modules: () => <ModulesAdminPage />,
  'module-detail': ({ pathname }) => (
    <ModuleDetailAdminPage moduleId={resolveStudioModuleId(pathname)} />
  ),
  apis: ({ routeId }) => <ApisAdminPage routeId={routeId as ApisAdminRouteId} />,
  'api-data-sources': ({ routeId }) => <ApisAdminPage routeId={routeId as ApisAdminRouteId} />,
  'api-operations': ({ routeId }) => <ApisAdminPage routeId={routeId as ApisAdminRouteId} />,
  auth: ({ routeId, studio }) => (
    <AuthAdminPage
      projectId={studio.projectId}
      manifest={studio.manifest}
      routeId={routeId as AuthAdminRouteId}
    />
  ),
  'auth-providers': ({ routeId, studio }) => (
    <AuthAdminPage
      projectId={studio.projectId}
      manifest={studio.manifest}
      routeId={routeId as AuthAdminRouteId}
    />
  ),
  'auth-routes': ({ routeId, studio }) => (
    <AuthAdminPage
      projectId={studio.projectId}
      manifest={studio.manifest}
      routeId={routeId as AuthAdminRouteId}
    />
  ),
  'auth-profile': ({ routeId, studio }) => (
    <AuthAdminPage
      projectId={studio.projectId}
      manifest={studio.manifest}
      routeId={routeId as AuthAdminRouteId}
    />
  ),
  secrets: ({ studio }) => <SecretsAdminPage projectId={studio.projectId} />,
  theme: () => <ThemeAdminPage />,
  'theme-colors': () => <ThemeColorsAdminPage />,
  'theme-typography': () => <ThemeTypographyAdminPage />,
  'theme-spacing': () => <ThemeNumericTokensAdminPage family="spacing" />,
  'theme-radii': () => <ThemeNumericTokensAdminPage family="radii" />,
  'theme-shadows': () => <ThemeNumericTokensAdminPage family="shadows" />,
  'theme-component': ({ pathname }) => (
    <ThemeRecipeAdminPage kind="component" recipeName={resolveStudioThemeRecipeName(pathname)} />
  ),
  'theme-pattern': ({ pathname }) => (
    <ThemeRecipeAdminPage kind="pattern" recipeName={resolveStudioThemeRecipeName(pathname)} />
  ),
  bindings: ({ pathname }) => <BindingsAdminPage nodeId={resolveStudioBindingsNodeId(pathname)} />,
  properties: ({ pathname }) => (
    <PropertiesAdminPage nodeId={resolveStudioPropertiesNodeId(pathname)} />
  ),
} satisfies Record<StudioAdminRouteId, AdminPageRenderer>;

export function AnkhAdminPage({ routeId }: AnkhAdminPageProps) {
  const studio = useStudio();
  const pathname = usePathname();
  const renderPage = ADMIN_PAGE_RENDERERS[routeId];

  return renderPage({ pathname, routeId, studio });
}
