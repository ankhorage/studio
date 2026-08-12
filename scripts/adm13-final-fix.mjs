import { readFileSync, writeFileSync } from 'node:fs';

const path = 'src/host/layout/layoutGenerator.test.ts';
const source = readFileSync(path, 'utf8');
const before = `    expect(paths).toContain('src/app/ankh/theme.tsx');`;
const after = `    expect(paths).toContain('src/app/ankh/theme/index.tsx');
    expect(paths).toContain('src/app/ankh/theme/colors.tsx');
    expect(paths).toContain('src/app/ankh/theme/typography.tsx');
    expect(paths).toContain('src/app/ankh/theme/spacing.tsx');
    expect(paths).toContain('src/app/ankh/theme/radii.tsx');
    expect(paths).toContain('src/app/ankh/theme/shadows.tsx');
    expect(paths).toContain('src/app/ankh/theme/components/[recipeName].tsx');
    expect(paths).toContain('src/app/ankh/theme/patterns/[recipeName].tsx');`;

if (!source.includes(before)) {
  throw new Error('Expected legacy Theme route assertion was not found.');
}

writeFileSync(path, source.replace(before, after));
