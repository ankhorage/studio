import type { ScreenMetadataSpec } from '@ankhorage/contracts';
import { STRUCTURE_DESCRIPTOR } from '@ankhorage/contracts/structure';

import type {
  StudioAuthoringMetadataRegistry,
  StudioAuthoringModel,
} from '../domain/authoringTypes';
import { deriveStudioAuthoringModel } from '../domain/deriveStudioAuthoringModel';

/*** Derive the canonical screen-metadata authoring model from Contracts-generated structure evidence. */
export function deriveStudioScreenMetadataAuthoringModel(
  screen: ScreenMetadataSpec,
): StudioAuthoringModel {
  return deriveStudioAuthoringModel({
    document: STRUCTURE_DESCRIPTOR,
    rootName: 'screen-metadata',
    value: screen,
    metadata: SCREEN_METADATA_AUTHORING_METADATA,
  });
}

const SCREEN_METADATA_AUTHORING_METADATA = {
  id: {
    label: 'Stable screen ID',
    description: 'Canonical ScreenSpec identity.',
    readOnly: true,
  },
  name: {
    label: 'Name',
    description: 'Canonical screen name used by Studio authoring.',
  },
  title: {
    label: 'Title',
    description: 'Optional human-facing screen title.',
  },
  description: {
    label: 'Description',
    description: 'Optional screen description.',
    multiline: true,
  },
} satisfies StudioAuthoringMetadataRegistry;
