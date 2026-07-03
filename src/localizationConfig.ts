export interface StudioLocalizationConfig {
  locales?: string[];
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

export function isStringArray(value: unknown): value is string[] {
  return Array.isArray(value) && value.every((item) => typeof item === 'string');
}

export function isStringRecord(value: unknown): value is Record<string, string> {
  return isRecord(value) && Object.values(value).every((item) => typeof item === 'string');
}

export function readLocalizationConfig(value: unknown): StudioLocalizationConfig | null {
  if (!isRecord(value)) {
    return null;
  }

  if (value.locales === undefined) {
    return {};
  }

  return isStringArray(value.locales) ? { locales: value.locales } : null;
}
