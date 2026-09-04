import type { AppManifest } from '@ankhorage/contracts';
import { composeCategoryAppManifest } from '@ankhorage/templates';

const ID_PREFIX = 'food_drink-nutrition-catalog-scan';

/*** Create the local Runtime/editor fixture used by the generated-admin smoke test. */
export function createAdminSmokeBaseManifest(): AppManifest {
  return composeCategoryAppManifest({
    category: 'food_drink',
    name: 'Generated Admin Web Smoke',
    slug: 'generated-admin-web-smoke',
    navigator: {
      type: 'tabs',
      initialRouteName: 'products',
      routes: [
        {
          name: 'products',
          label: 'Products',
          path: 'products',
          screenId: `${ID_PREFIX}-catalog`,
          icon: { provider: 'Ionicons', name: 'cube-outline' },
        },
        {
          name: 'scan',
          label: 'Scan',
          path: 'scan',
          screenId: `${ID_PREFIX}-scan`,
          icon: { provider: 'Ionicons', name: 'scan-outline' },
        },
      ],
    },
    screens: {
      [`${ID_PREFIX}-catalog`]: {
        id: `${ID_PREFIX}-catalog`,
        name: 'Products',
        root: {
          id: `${ID_PREFIX}-products-screen`,
          type: 'Screen',
          props: { width: 'wide' },
          children: [
            {
              id: `${ID_PREFIX}-products-header`,
              type: 'SectionHeader',
              props: {
                eyebrow: 'Nutrition catalog',
                title: 'Catalog products',
                description: 'Local generated-admin smoke fixture.',
              },
            },
            {
              id: `${ID_PREFIX}-products-search-field`,
              type: 'FormField',
              props: {
                label: 'Search products',
                description: 'Search the local smoke fixture.',
              },
            },
            {
              id: `${ID_PREFIX}-products-search-input`,
              type: 'Input',
              props: {
                placeholder: 'Search product name, brand, or barcode...',
                autoCapitalize: 'none',
                size: 'm',
              },
            },
          ],
        },
      },
      [`${ID_PREFIX}-scan`]: {
        id: `${ID_PREFIX}-scan`,
        name: 'Scan',
        root: {
          id: `${ID_PREFIX}-scan-screen`,
          type: 'Screen',
          props: { width: 'wide' },
          children: [
            {
              id: `${ID_PREFIX}-scan-header`,
              type: 'SectionHeader',
              props: {
                eyebrow: 'Nutrition catalog',
                title: 'Scan product',
                description: 'Local generated-admin smoke fixture.',
              },
            },
          ],
        },
      },
    },
  }).manifest;
}
