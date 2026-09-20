import type { AuthoringPresentationPolicy } from '../../../types/authoring-engine';

/*** Refine ScreenMetadataSpec presentation without duplicating its structural shape. */
export const screenMetadataAuthoringPolicy = {
  label: 'Screen metadata',
  fields: {
    id: {
      label: 'Stable screen ID',
      readOnly: true,
    },
    description: {
      multiline: true,
    },
  },
} as const satisfies AuthoringPresentationPolicy;
