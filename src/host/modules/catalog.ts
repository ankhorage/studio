import type { AppManifest } from '@ankhorage/contracts';
import type { ModuleAction, ModuleDefinition } from '@ankhorage/orchestrator';
import {
  EXPO_GOOGLE_FONTS_MODULE_ID,
  expoGoogleFontsModule,
  type NormalizedExpoGoogleFontsModuleConfig,
  parseExpoGoogleFontsModuleConfig,
} from '@ankhorage/orchestrator-module-expo-google-fonts';
import {
  EXPO_LOCALIZATION_MODULE_ID,
  expoLocalizationModule,
  parseExpoLocalizationModuleConfig,
} from '@ankhorage/orchestrator-module-expo-localization';

import type { LayoutMutation } from './layout';

export interface HostManifest extends AppManifest {
  infra: AppManifest['infra'] & {
    modulesConfig?: Record<string, unknown>;
  };
  settings: AppManifest['settings'] & {
    googleFonts?: NormalizedExpoGoogleFontsModuleConfig;
  };
  typography?: {
    activeFontId?: string | null;
  };
}

export interface HostModuleDefinition {
  id: string;
  name: string;
  description: string;
  definition: ModuleDefinition<Record<string, unknown>>;
  normalizeConfig: (config: Record<string, unknown>) => Record<string, unknown>;
  readStoredConfig: (manifest: HostManifest) => Record<string, unknown>;
  applyManifestConfig: (manifest: HostManifest, config: Record<string, unknown>) => HostManifest;
  layout?: LayoutMutation;
  ui?: {
    modal?: { title: string };
  };
  proxyGet?: (path: string) => Promise<unknown>;
}

const localizationLayout: LayoutMutation = {
  imports: ['import { LocalizationModuleProvider } from "@/modules/localization";'],
  hooks: [],
  providerStart: ['<LocalizationModuleProvider>'],
  providerEnd: ['</LocalizationModuleProvider>'],
};

const googleFontsLayout: LayoutMutation = {
  imports: ['import { GoogleFontsProvider } from "@/modules/google-fonts";'],
  hooks: [],
  providerStart: ['<GoogleFontsProvider>'],
  providerEnd: ['</GoogleFontsProvider>'],
};

function isHostManagedAction(action: ModuleAction): boolean {
  return (
    (action.type === 'patch-text-block' && action.path === 'src/app/_layout.tsx') ||
    (action.type === 'json-set' && action.path === 'ankh.config.json')
  );
}

function wrapHostManagedModule(
  definition: ModuleDefinition<Record<string, unknown>>,
): ModuleDefinition<Record<string, unknown>> {
  return {
    ...definition,
    async plan(context) {
      const actions = await definition.plan(context);
      return actions.filter((action) => !isHostManagedAction(action));
    },
  };
}

const localizationModule: HostModuleDefinition = {
  id: EXPO_LOCALIZATION_MODULE_ID,
  name: 'Localization (Expo)',
  description: 'Multi-language support powered by expo-localization and i18next.',
  definition: wrapHostManagedModule(expoLocalizationModule),
  normalizeConfig(config) {
    return parseExpoLocalizationModuleConfig(config);
  },
  readStoredConfig(manifest) {
    const storedConfig = manifest.infra.modulesConfig?.[EXPO_LOCALIZATION_MODULE_ID];
    if (isRecord(storedConfig)) {
      return storedConfig;
    }

    return {
      defaultLocale: manifest.settings.localization.defaultLocale,
      locales: manifest.settings.localization.locales,
    };
  },
  applyManifestConfig(manifest, config) {
    const normalizedConfig = parseExpoLocalizationModuleConfig(config);
    return {
      ...manifest,
      settings: {
        ...manifest.settings,
        localization: {
          defaultLocale: normalizedConfig.defaultLocale,
          locales: normalizedConfig.locales,
        },
      },
    };
  },
  layout: localizationLayout,
};

const googleFontsModule: HostModuleDefinition = {
  id: EXPO_GOOGLE_FONTS_MODULE_ID,
  name: 'Google Fonts (Expo)',
  description: 'Deterministic Google Fonts integration via @expo-google-fonts packages.',
  definition: wrapHostManagedModule(expoGoogleFontsModule),
  normalizeConfig(config) {
    return { ...parseExpoGoogleFontsModuleConfig(config) };
  },
  readStoredConfig(manifest) {
    const storedConfig = manifest.infra.modulesConfig?.[EXPO_GOOGLE_FONTS_MODULE_ID];
    const baseConfig = isRecord(storedConfig)
      ? storedConfig
      : isRecord(manifest.settings.googleFonts)
        ? manifest.settings.googleFonts
        : {};
    const activeFontId =
      typeof manifest.typography?.activeFontId === 'string'
        ? manifest.typography.activeFontId
        : undefined;

    return {
      ...parseExpoGoogleFontsModuleConfig(
        activeFontId === undefined ? baseConfig : { ...baseConfig, activeFontId },
      ),
    };
  },
  applyManifestConfig(manifest, config) {
    const normalizedConfig = parseExpoGoogleFontsModuleConfig(config);

    return {
      ...manifest,
      settings: {
        ...manifest.settings,
        googleFonts: normalizedConfig,
      },
      typography: {
        ...manifest.typography,
        activeFontId: normalizedConfig.activeFontId,
      },
    };
  },
  layout: googleFontsLayout,
  ui: {
    modal: { title: 'Google Fonts' },
  },
};

export const MODULE_CATALOG = {
  [localizationModule.id]: localizationModule,
  [googleFontsModule.id]: googleFontsModule,
} satisfies Record<string, HostModuleDefinition>;

export function listHostModules(): HostModuleDefinition[] {
  return Object.values(MODULE_CATALOG);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
