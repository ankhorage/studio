import { cp, mkdir } from 'node:fs/promises';
import path from 'node:path';

const STUDIO_CONSUMER_PATHS = [
  '.gitignore',
  '.prettierrc.js',
  'ankh.config.json',
  'app.config.ts',
  'eslint.config.mjs',
  'package.json',
  'scripts',
  'src',
  'tsconfig.json',
] as const;

export async function createExpo57StudioStandaloneFixtureAsync(options: {
  readonly fixtureRoot: string;
  readonly repositoryRoot: string;
}): Promise<void> {
  const sourceRoot = path.join(options.repositoryRoot, 'apps', 'studio');
  const relativeFixturePath = path.relative(options.repositoryRoot, options.fixtureRoot);
  if (!relativeFixturePath.startsWith('..') || path.isAbsolute(relativeFixturePath)) {
    throw new Error('Standalone Studio fixture must live outside the repository checkout.');
  }

  await mkdir(options.fixtureRoot, { recursive: true });
  await Promise.all(
    STUDIO_CONSUMER_PATHS.map((relativePath) =>
      cp(path.join(sourceRoot, relativePath), path.join(options.fixtureRoot, relativePath), {
        recursive: true,
      }),
    ),
  );
}
