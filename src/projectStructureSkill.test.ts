import { readFileSync } from 'node:fs';

import { describe, expect, test } from 'bun:test';

const projectStructureSkillPath = new URL(
  '../.agents/skills/ankhorage-project-structure/SKILL.md',
  import.meta.url,
);
const projectStructureUtilitiesPath = new URL(
  '../.agents/skills/ankhorage-project-structure/references/utilities.md',
  import.meta.url,
);
const managedManifestPath = new URL('../.agents/.devtools-manifest.json', import.meta.url);

describe('ankhorage-project-structure managed skill', () => {
  test('is self-contained and no longer references the obsolete package-structure skill', () => {
    const skillText = readFileSync(projectStructureSkillPath, 'utf8');
    const utilitiesText = readFileSync(projectStructureUtilitiesPath, 'utf8');
    const manifestText = readFileSync(managedManifestPath, 'utf8');

    expect(skillText).toContain('Load `ankhorage-coding-rules` when available.');
    expect(skillText).not.toContain('ankhorage-package-structure');
    expect(utilitiesText).not.toContain('ankhorage-package-structure');
    expect(manifestText).not.toContain('ankhorage-package-structure');
  });
});
