import { expect, test } from 'bun:test';
import { readFileSync } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

/*** Read one deploy-admin sibling as migration evidence without coupling tests to rendered DOM details. */
function readSibling(name: string): string {
  return readFileSync(path.join(path.dirname(fileURLToPath(import.meta.url)), name), 'utf8');
}

test('routes Monetization and Release authoring through Deploy projections and the shared engine', () => {
  const monetization = readSibling('DeployMonetizationAuthoringCard.tsx');
  const release = readSibling('DeployPreparedReleaseAuthoringCard.tsx');

  expect(monetization).toContain('props.authoring.data.structure');
  expect(monetization).toContain('writeProjectDeployMonetizationAuthoring');
  expect(monetization).toContain('<DeployOwnerAuthoringEditor');
  expect(monetization).not.toContain('JSON.parse');
  expect(monetization).not.toContain('JSON.stringify');
  expect(monetization).not.toContain('<Input');

  expect(release).toContain('props.authoring.data.structure');
  expect(release).toContain('writeProjectDeployReleaseAuthoring');
  expect(release).toContain('<DeployOwnerAuthoringEditor');
  expect(release).not.toContain('JSON.parse');
  expect(release).not.toContain('JSON.stringify');
  expect(release).not.toContain('<Input');
});

test('removes local locale field interpretation and comma-list parsing', () => {
  const source = readSibling('DeployListingLocaleAuthoringCard.tsx');

  expect(source).toContain("'store-listing-locale'");
  expect(source).toContain('<DeployOwnerAuthoringEditor');
  expect(source).not.toContain("split(',')");
  expect(source).not.toContain('optionalField');
  expect(source).not.toContain('<Input');
});

test('removes local store-asset variant and finite-choice catalogs', () => {
  const source = readSibling('DeployStoreAssetAuthoringCard.tsx');

  expect(source).toContain("'store-listing-asset-location'");
  expect(source).toContain('<DeployOwnerAuthoringEditor');
  expect(source).not.toContain('KIND_OPTIONS');
  expect(source).not.toContain('TARGET_OPTIONS');
  expect(source).not.toContain('SHARED_VARIANT_OPTIONS');
  expect(source).not.toContain('createLocation');
  expect(source).not.toContain('<Select');
  expect(source).not.toContain('<Input');
});

test('keeps the Deploy adapter thin over the neutral model and immutable mutation boundary', () => {
  const source = readSibling('DeployOwnerAuthoringEditor.tsx');

  expect(source).toContain('deriveAuthoringModel');
  expect(source).toContain('applyAuthoringMutationToStructure');
  expect(source).toContain('<AuthoringEditor');
  expect(source).not.toContain('@ankhorage/deploy');
});
