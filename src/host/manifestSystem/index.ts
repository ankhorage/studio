import type { AppManifest } from '@ankhorage/contracts';

import {
  inferScreenRequirementsFromUi,
  mergeScreenRequirements,
} from '../utils/requirementsInference';
import { SYSTEM_TEMPLATE_AUTH_GLOBAL_DEFAULT } from './auth';
import type { ManifestSystemTemplate } from './types';

export * from './auth';
export * from './types';

const SYSTEM_MANIFEST_TEMPLATES: ManifestSystemTemplate[] = [SYSTEM_TEMPLATE_AUTH_GLOBAL_DEFAULT];

/***
 * Apply Studio-owned system templates and inferred screen requirements to a canonical manifest.
 * @todo Move manifest enrichment from the host edge into the manifest application domain.
 */
export function applySystemTemplates(manifest: AppManifest): AppManifest {
  const enrichedManifest = SYSTEM_MANIFEST_TEMPLATES.reduce((currentManifest, template) => {
    if (!template.applies(currentManifest)) {
      return currentManifest;
    }
    return template.apply(currentManifest);
  }, manifest);

  return {
    ...enrichedManifest,
    screens: Object.fromEntries(
      Object.entries(enrichedManifest.screens).map(([id, screen]) => {
        const inferred = inferScreenRequirementsFromUi(screen.root);
        const merged = mergeScreenRequirements(screen.requires, inferred);
        return [id, { ...screen, requires: merged }];
      }),
    ),
  };
}
