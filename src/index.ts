export const STUDIO_PACKAGE_NAME = '@ankhorage/studio' as const;

export interface StudioPackageBoundary {
  readonly owns: readonly string[];
  readonly consumes: readonly string[];
  readonly doesNotOwn: readonly string[];
}

export const STUDIO_PACKAGE_BOUNDARY: StudioPackageBoundary = {
  owns: ['Studio authoring contracts', 'Studio product contracts'],
  consumes: [
    '@ankhorage/runtime',
    '@ankhorage/expo-runtime',
    '@ankhorage/templates',
    '@ankhorage/ankh',
  ],
  doesNotOwn: [
    'generic runtime renderer behavior',
    'generic runtime actions or bindings',
    'Expo runtime planning',
    'generated-app overlay code',
    'template catalog content',
    'root command bus behavior',
  ],
};
