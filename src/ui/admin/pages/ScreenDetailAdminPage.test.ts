import { expect, test } from 'bun:test';
import { readFileSync } from 'node:fs';

const source = readFileSync(
  new URL('./ScreenDetailAdminPage.tsx', import.meta.url),
  'utf8',
);

test('keeps route detail behavior while delegating screen metadata authoring to the central engine', () => {
  expect(source).toContain('deriveStudioScreenNavigationModel');
  expect(source).toContain('resolveStudioScreenAppPath');
  expect(source).toContain('Screen not found');
  expect(source).toContain('Screen identity is ambiguous');
  expect(source).toContain('matchingEntries.length > 1');
  expect(source).toContain('routeReferences.map');
  expect(source).toContain('Canonical pathname/pattern');
  expect(source).toContain('Primary-navigation visibility');

  expect(source).toContain('STRUCTURE_DESCRIPTOR');
  expect(source).toContain("'screen-metadata'");
  expect(source).toContain('resolveContractsAuthoringStructure');
  expect(source).toContain('deriveAuthoringModel');
  expect(source).toContain('<AuthoringEditor');
  expect(source).toContain('applyAuthoringMutation');
  expect(source).toContain('studio.updateScreenMetadata');

  expect(source).not.toContain('<MetadataFact label="Name"');
  expect(source).not.toContain('<MetadataFact label="Title"');
  expect(source).not.toContain('<MetadataFact label="Description"');
  expect(source).not.toContain('useState');
  expect(source).not.toContain('model.screens.find');
});
