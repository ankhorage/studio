export interface StudioLocalizationPreviewInput {
  readonly activeLocale?: string | null;
  readonly defaultLocale: string;
  readonly locales: readonly string[];
}

export interface StudioLocalizationPreview {
  readonly activeLocale: string;
  readonly defaultLocale: string;
  readonly locales: readonly string[];
}

export const resolveStudioLocalizationPreview = (
  input: StudioLocalizationPreviewInput,
): StudioLocalizationPreview => {
  const activeLocale =
    input.activeLocale && input.locales.includes(input.activeLocale)
      ? input.activeLocale
      : input.defaultLocale;

  return {
    activeLocale,
    defaultLocale: input.defaultLocale,
    locales: input.locales,
  };
};
