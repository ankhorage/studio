import { describe, expect, test } from 'bun:test';

import { getRootShellImportRequirements, getRootShellTsx } from './rootShell';

describe('generated root shell', () => {
  test('exposes a post-hydration interaction boundary for browser acceptance', () => {
    const imports = getRootShellImportRequirements('@ankhorage/zora');
    const source = getRootShellTsx("import { useEffect, useState } from 'react';");

    const reactImports = imports.find((requirement) => requirement.source === 'react');
    expect(reactImports?.namedImports).toContainEqual({ imported: 'useEffect' });
    expect(reactImports?.namedImports).toContainEqual({ imported: 'useState' });
    expect(source).toContain('const [interactive, setInteractive] = useState(false);');
    expect(source).toContain('const frame = requestAnimationFrame(() => {');
    expect(source).toContain('return () => cancelAnimationFrame(frame);');
    expect(source).toContain("testID={interactive ? 'ankh-app-interactive' : 'ankh-app-loading'}");
  });
});
