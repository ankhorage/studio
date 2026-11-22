import { readFileSync } from 'node:fs';

import { describe, expect, test } from 'bun:test';

const projectStructureSkillPath = new URL(
  '../.agents/skills/ankhorage-project-structure/SKILL.md',
  import.meta.url,
);
const hexagonalReferencePath = new URL(
  '../.agents/skills/ankhorage-project-structure/references/hexagonal-architecture.md',
  import.meta.url,
);
const managedManifestPath = new URL('../.agents/.devtools-manifest.json', import.meta.url);

describe('ankhorage-project-structure managed skill', () => {
  test('uses the canonical non-selectable Hexagonal Architecture reference', () => {
    const skillText = readFileSync(projectStructureSkillPath, 'utf8');
    const referenceText = readFileSync(hexagonalReferencePath, 'utf8');
    const manifestText = readFileSync(managedManifestPath, 'utf8');

    expect(skillText).toContain('references/hexagonal-architecture.md');
    expect(skillText).not.toContain('<repo-root>/.agents/skills/hexagonal-architecture/SKILL.md');
    expect(referenceText).toContain('# Hexagonal Architecture');
    expect(manifestText).not.toContain('"hexagonal-architecture":');
    expect(skillText).not.toContain('ankhorage-package-structure');
    expect(manifestText).not.toContain('ankhorage-package-structure');
  });
});
