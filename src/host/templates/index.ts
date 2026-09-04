import { promises as fs } from 'node:fs';
import { createRequire } from 'node:module';
import { basename, dirname, join } from 'node:path';

import type { AppCategory, MediaAsset } from '@ankhorage/contracts';
import {
  CATEGORY_PRESETS,
  createTemplateArtifact,
  listTemplates,
  type TemplateImageAsset,
} from '@ankhorage/templates';

import type { TemplateCatalog, TemplateCatalogTemplate } from '../../templateCatalogContracts';
import type {
  ProjectCreationAsset,
  ProjectCreationSource,
} from '../orchestrator/projectCreationSource';

export interface ProjectTemplateSelection {
  readonly category: AppCategory;
  readonly slug: string;
}

const require = createRequire(import.meta.url);
const TEMPLATES_PACKAGE_ROOT = dirname(require.resolve('@ankhorage/templates/package.json'));

/***
 * List the published standalone templates grouped by their existing category metadata.
 * @todo Move Studio template catalog projection from host/templates to the top-level templates domain; host should only expose it through adapters.
 */
export function getTemplateCatalog(): TemplateCatalog {
  const templates = listTemplates();
  return {
    categories: Object.entries(CATEGORY_PRESETS).map(([categoryId, preset]) => {
      const category = categoryId as AppCategory;
      const categoryTemplates = templates
        .filter((template) => template.category === category)
        .map(createCatalogTemplate);
      return {
        id: category,
        label: preset.label,
        summary: preset.summary,
        focusAreas: [...preset.focusAreas],
        primaryColor: preset.recommendedPrimaryColors[0],
        harmony: preset.recommendedHarmonies[0],
        templateCount: categoryTemplates.length,
        templates: categoryTemplates,
      };
    }),
  };
}

/***
 * Resolve one published portable template to the source-agnostic input used by project creation.
 * @todo Move portable-template source resolution beside the templates/projects application boundary rather than owning it under host.
 */
export async function getProjectTemplateSource(
  selection: ProjectTemplateSelection,
): Promise<ProjectCreationSource> {
  const artifact = createTemplateArtifact(selection);
  return {
    manifest: artifact.manifest,
    assets: await Promise.all(
      artifact.assets.map((asset) =>
        readTemplateImageAsset(artifact.manifest.media?.assets, asset),
      ),
    ),
  };
}

/*** Convert one public template catalog entry to the Studio transport shape. */
function createCatalogTemplate(
  template: ReturnType<typeof listTemplates>[number],
): TemplateCatalogTemplate {
  return {
    id: `${template.category}/${template.slug}`,
    slug: template.slug,
    name: template.name,
  };
}

/*** Read one published template image and preserve its canonical manifest media metadata. */
async function readTemplateImageAsset(
  mediaAssets: Readonly<Record<string, MediaAsset>> | undefined,
  asset: TemplateImageAsset,
): Promise<ProjectCreationAsset> {
  const media = mediaAssets?.[asset.mediaId];
  if (!media) {
    throw new Error(
      `Template image '${asset.mediaId}' is missing from its manifest media registry.`,
    );
  }
  const body = await fs.readFile(join(TEMPLATES_PACKAGE_ROOT, asset.sourcePath));
  return {
    assetId: media.id,
    name: media.name,
    fileName: getTemplateImageFileName(asset.targetPath),
    kind: media.kind,
    body,
    contentType: asset.contentType ?? media.contentType,
    sizeBytes: media.metadata?.sizeBytes ?? body.byteLength,
    width: media.metadata?.width,
    height: media.metadata?.height,
    durationMs: media.metadata?.durationMs,
  };
}

/*** Extract the packaged file name used when materializing a template image into a generated project. */
export function getTemplateImageFileName(targetPath: string): string {
  return basename(targetPath);
}
