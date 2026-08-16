import { existsSync } from 'node:fs';
import { mkdir } from 'node:fs/promises';
import path from 'node:path';

import { createAuth5NativeOAuthSmokeFixture } from './createAuth5NativeOAuthSmokeFixture';

const outputArg = process.argv[2]?.trim();
if (!outputArg) {
  throw new Error('Usage: bun run smoke:auth5-native:prepare -- <workspace-path>');
}

const workspaceRoot = path.resolve(outputArg);
if (existsSync(workspaceRoot)) {
  throw new Error(`Smoke workspace already exists: ${workspaceRoot}`);
}

await mkdir(workspaceRoot, { recursive: true });
const fixture = await createAuth5NativeOAuthSmokeFixture(workspaceRoot);

console.log(
  [
    `Auth 5 native OAuth smoke workspace: ${fixture.workspaceRoot}`,
    `Generated app: ${fixture.projectRoot}`,
    `Manifest: ${path.join(fixture.projectRoot, 'ankh.config.json')}`,
    '',
    'Next, from the Studio repository activate the smoke project Infra with a configured',
    'source project that owns the trusted Google Web credential:',
    `  bun run smoke:auth5-native:infra -- ${fixture.workspaceRoot} --credentials-project <project-id>`,
    '',
    'Then:',
    `  cd ${fixture.projectRoot}`,
    '  bun install',
    '  bun run android',
    '  bun run ios',
    '',
    'Use docs/auth5-native-oauth-smoke.md for the verification matrix.',
  ].join('\n'),
);
