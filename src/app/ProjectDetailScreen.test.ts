import { readFileSync } from 'node:fs';
import path from 'node:path';

import { expect, test } from 'bun:test';

const projectDetailSource = readFileSync(
  path.join(import.meta.dir, 'ProjectDetailScreen.tsx'),
  'utf8',
);
const updatePanelSource = readFileSync(
  path.join(
    import.meta.dir,
    '..',
    'features',
    'project-updates',
    'adapters',
    'inbound',
    'ProjectUpdateDashboardPanel.tsx',
  ),
  'utf8',
);

test('uses the APM Dashboard lifecycle instead of direct sync/install update controls', () => {
  expect(projectDetailSource).toContain('<ProjectUpdateDashboardPanel projectId={project.id} />');
  expect(projectDetailSource).not.toContain('label="Sync"');
  expect(projectDetailSource).not.toContain('label="Install packages"');
  expect(updatePanelSource).toContain('label="Inspect updates"');
  expect(updatePanelSource).toContain('label="Review update plan"');
  expect(updatePanelSource).toContain('label="Apply reviewed plan"');
  expect(updatePanelSource).toContain('label="Resume operation"');
  expect(updatePanelSource).toContain('label="Verify operation"');
  expect(updatePanelSource).not.toContain('rootPath');
});

test('keeps repeated Dashboard detail rows keyed independently', () => {
  expect(updatePanelSource).toContain('props.items.map((item, index) => (');
  expect(updatePanelSource).toContain('<Text key={`${item} · ${index}`} variant="caption">');
  expect(updatePanelSource).not.toContain('<Text key={item} variant="caption">');
});
