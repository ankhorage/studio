import { COLOR_HARMONIES, type ColorHarmony } from '@ankhorage/color-theory';
import {
  APP_CATEGORIES,
  type AppCategory,
  type AppManifest,
  type AppSettings,
  type InfraManifest,
  NAVIGATOR_TYPES,
  type NavigatorSpec,
  type NavigatorType,
  type RouteDefinition,
  type ScreenSpec,
  type ThemeConfig,
  type ThemeModeConfig,
  type UiNode,
} from '@ankhorage/contracts';

const APP_CATEGORY_SET = new Set<string>(APP_CATEGORIES);
const COLOR_HARMONY_SET = new Set<string>(COLOR_HARMONIES);
const NAVIGATOR_TYPE_SET = new Set<string>(NAVIGATOR_TYPES);

export function isAppCategory(value: unknown): value is AppCategory {
  return typeof value === 'string' && APP_CATEGORY_SET.has(value);
}

export function isColorHarmony(value: unknown): value is ColorHarmony {
  return typeof value === 'string' && COLOR_HARMONY_SET.has(value);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function isNavigatorType(value: unknown): value is NavigatorType {
  return typeof value === 'string' && NAVIGATOR_TYPE_SET.has(value);
}

function isThemeModeConfig(value: unknown): value is ThemeModeConfig {
  return isRecord(value) && typeof value.primaryColor === 'string' && isColorHarmony(value.harmony);
}

function isThemeConfig(value: unknown): value is ThemeConfig {
  return (
    isRecord(value) &&
    typeof value.id === 'string' &&
    typeof value.name === 'string' &&
    isThemeModeConfig(value.light) &&
    isThemeModeConfig(value.dark)
  );
}

function isUiNode(value: unknown): value is UiNode {
  return (
    isRecord(value) &&
    typeof value.id === 'string' &&
    typeof value.type === 'string' &&
    (value.alias === undefined || typeof value.alias === 'string') &&
    (value.props === undefined || isRecord(value.props)) &&
    (value.style === undefined || isRecord(value.style)) &&
    (value.children === undefined ||
      (Array.isArray(value.children) && value.children.every(isUiNode)))
  );
}

function isScreenSpec(value: unknown): value is ScreenSpec {
  return (
    isRecord(value) &&
    typeof value.id === 'string' &&
    typeof value.name === 'string' &&
    (value.title === undefined || typeof value.title === 'string') &&
    (value.description === undefined || typeof value.description === 'string') &&
    isUiNode(value.root)
  );
}

function isRouteDefinition(value: unknown): value is RouteDefinition {
  return (
    isRecord(value) &&
    typeof value.name === 'string' &&
    (value.path === undefined || typeof value.path === 'string') &&
    (value.label === undefined || typeof value.label === 'string') &&
    (value.hideInTabBar === undefined || typeof value.hideInTabBar === 'boolean') &&
    (value.guards === undefined ||
      (Array.isArray(value.guards) && value.guards.every((guard) => typeof guard === 'string'))) &&
    (value.screenId === undefined || typeof value.screenId === 'string') &&
    (value.navigator === undefined || isNavigatorSpec(value.navigator))
  );
}

function isNavigatorSpec(value: unknown): value is NavigatorSpec {
  return (
    isRecord(value) &&
    isNavigatorType(value.type) &&
    (value.initialRouteName === undefined || typeof value.initialRouteName === 'string') &&
    Array.isArray(value.routes) &&
    value.routes.every(isRouteDefinition) &&
    (value.options === undefined || isRecord(value.options))
  );
}

function isInfraManifest(value: unknown): value is InfraManifest {
  return (
    isRecord(value) &&
    Array.isArray(value.plugins) &&
    value.plugins.every((plugin) => typeof plugin === 'string') &&
    (value.pluginsConfig === undefined || isRecord(value.pluginsConfig))
  );
}

function isAppSettings(value: unknown): value is AppSettings {
  return (
    isRecord(value) &&
    isRecord(value.localization) &&
    typeof value.localization.defaultLocale === 'string' &&
    Array.isArray(value.localization.locales) &&
    value.localization.locales.every((locale) => typeof locale === 'string') &&
    (value.apiBaseUrl === undefined || typeof value.apiBaseUrl === 'string')
  );
}

function isScreenRegistry(value: unknown): value is Record<string, ScreenSpec> {
  return isRecord(value) && Object.values(value).every(isScreenSpec);
}

export function isAppManifest(value: unknown): value is AppManifest {
  return (
    isRecord(value) &&
    isRecord(value.metadata) &&
    typeof value.metadata.name === 'string' &&
    typeof value.metadata.slug === 'string' &&
    typeof value.metadata.version === 'string' &&
    isAppCategory(value.metadata.category) &&
    typeof value.metadata.themeId === 'string' &&
    (value.metadata.created === undefined || typeof value.metadata.created === 'string') &&
    (value.metadata.updated === undefined || typeof value.metadata.updated === 'string') &&
    Array.isArray(value.themes) &&
    value.themes.every(isThemeConfig) &&
    typeof value.activeThemeId === 'string' &&
    (value.activeThemeMode === undefined ||
      value.activeThemeMode === 'dark' ||
      value.activeThemeMode === 'light') &&
    isInfraManifest(value.infra) &&
    isNavigatorSpec(value.navigator) &&
    isScreenRegistry(value.screens) &&
    isAppSettings(value.settings)
  );
}
