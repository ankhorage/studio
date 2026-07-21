import { expect, test } from 'bun:test';

import { composeGeneratedImports } from './generatedImportComposer';

test('merges repeated imports from the same source without duplicate local bindings', () => {
  const generated = composeGeneratedImports([
    "import { useCallback, useEffect, useMemo, useRef, useState } from 'react';",
    "import { cloneElement, isValidElement, useState, type ReactNode } from 'react';",
  ]);

  expect(generated.match(/from 'react';/gu)?.length).toBe(1);
  expect(generated.match(/\buseState\b/gu)?.length).toBe(1);
  expect(generated).toContain('cloneElement');
  expect(generated).toContain('isValidElement');
  expect(generated).toContain('type ReactNode');
});

test('merges multiple declarations supplied in one generated import fragment', () => {
  const generated = composeGeneratedImports([
    `import {
  createComponentRegistry,
  RuntimeRendererConfigProvider,
} from '@ankhorage/runtime';
import { useRuntimeAction } from '@ankhorage/studio/runtime';`,
    "import { createRuntimeDataSourceOperationExecutor } from '@ankhorage/runtime';",
  ]);

  expect(generated.match(/from '@ankhorage\/runtime';/gu)?.length).toBe(1);
  expect(generated).toContain('createComponentRegistry');
  expect(generated).toContain('createRuntimeDataSourceOperationExecutor');
  expect(generated).toContain('RuntimeRendererConfigProvider');
  expect(generated).toContain("import { useRuntimeAction } from '@ankhorage/studio/runtime';");
});

test('rejects conflicting generated local bindings', () => {
  expect(() =>
    composeGeneratedImports([
      "import { first as shared } from 'first-package';",
      "import { second as shared } from 'second-package';",
    ]),
  ).toThrow("Generated imports bind 'shared' more than once");
});
