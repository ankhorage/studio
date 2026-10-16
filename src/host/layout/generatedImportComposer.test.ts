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
import { useStudioRuntimeCapabilityExecutor } from '@ankhorage/studio/runtime';`,
    "import { createRuntimeApiCapabilityExecutor } from '@ankhorage/runtime';",
  ]);

  expect(generated.match(/from '@ankhorage\/runtime';/gu)?.length).toBe(1);
  expect(generated).toContain('createComponentRegistry');
  expect(generated).toContain('createRuntimeApiCapabilityExecutor');
  expect(generated).toContain('RuntimeRendererConfigProvider');
  expect(generated).toContain(
    "import { useStudioRuntimeCapabilityExecutor } from '@ankhorage/studio/runtime';",
  );
});

test('renders generated imports in app lint order and formats long named clauses', () => {
  const generated = composeGeneratedImports([
    "import { composeRuntimeCapabilityExecutor, useOptionalManifestContext, createRuntimeApiCapabilityExecutor, RuntimeRendererConfigProvider, type RuntimeCapabilityExecutor } from '@ankhorage/runtime';",
    "import { bundledMediaRegistry } from '@/generated/bundledMediaRegistry';",
    "import { executeExpoRuntimeCapabilityAsync } from '@ankhorage/expo-runtime/capability-bridge';",
  ]);

  expect(generated)
    .toBe(`import { executeExpoRuntimeCapabilityAsync } from '@ankhorage/expo-runtime/capability-bridge';
import {
  composeRuntimeCapabilityExecutor,
  createRuntimeApiCapabilityExecutor,
  type RuntimeCapabilityExecutor,
  RuntimeRendererConfigProvider,
  useOptionalManifestContext,
} from '@ankhorage/runtime';

import { bundledMediaRegistry } from '@/generated/bundledMediaRegistry';`);
});

test('formats a named clause when its complete import statement exceeds the print width', () => {
  const generated = composeGeneratedImports([
    "import { AppShell, useZoraTheme, ZORA_COMPONENT_META, ZORA_COMPONENT_REGISTRY, ZoraProvider } from '@ankhorage/zora';",
  ]);

  expect(generated).toBe(`import {
  AppShell,
  useZoraTheme,
  ZORA_COMPONENT_META,
  ZORA_COMPONENT_REGISTRY,
  ZoraProvider,
} from '@ankhorage/zora';`);
});

test('keeps one long aliased named import on one line', () => {
  const generated = composeGeneratedImports([
    "import { APP_EXTENSION_COMPONENT_REGISTRY as GENERATED_APP_EXTENSION_COMPONENT_REGISTRY } from '@/generated/appExtensionRegistry';",
  ]);

  expect(generated).toBe(
    "import { APP_EXTENSION_COMPONENT_REGISTRY as GENERATED_APP_EXTENSION_COMPONENT_REGISTRY } from '@/generated/appExtensionRegistry';",
  );
});

test('rejects conflicting generated local bindings', () => {
  expect(() =>
    composeGeneratedImports([
      "import { first as shared } from 'first-package';",
      "import { second as shared } from 'second-package';",
    ]),
  ).toThrow("Generated imports bind 'shared' more than once");
});
