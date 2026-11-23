import type { FastifyInstance } from '@ankhorage/api-fastify';

import { getProjectTemplateSource, getTemplateCatalog } from '../templates';

/*** Expose only the published Acquisition demo manifest for Studio's read-only design preview. */
export function registerAcquisitionPreviewRoute(fastify: FastifyInstance): void {
  fastify.get(
    '/api/templates/business_productivity/acquisition/preview',
    async (_request, reply) => {
      const available = getTemplateCatalog()
        .categories.find((category) => category.id === 'business_productivity')
        ?.templates.some((template) => template.slug === 'acquisition');

      if (!available) {
        return reply.status(404).send({
          error: 'The Acquisition template has not been published yet.',
        });
      }

      const source = await getProjectTemplateSource({
        category: 'business_productivity',
        slug: 'acquisition',
      });
      return {
        manifest: source.manifest,
        assets: Object.fromEntries(
          source.assets.map((asset) => [
            asset.assetId,
            `data:${asset.contentType ?? 'application/octet-stream'};base64,${Buffer.from(asset.body).toString('base64')}`,
          ]),
        ),
      };
    },
  );
}
