import { cp, mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';

const STUDIO_CONSUMER_PATHS = [
  '.gitignore',
  '.prettierrc.js',
  'ankh.config.json',
  'app.config.ts',
  'bun.lock',
  'eas.json',
  'eslint.config.mjs',
  'eslint.local.config.mjs',
  'knip.config.ts',
  'metro.config.js',
  'metro.empty-module.js',
  'package.json',
  'prettier.local.config.js',
  'scripts',
  'src',
  'tsconfig.json',
] as const;

/*** Copy the Studio consumer surface into an external standalone acceptance fixture.
 */
export async function createExpo57StudioStandaloneFixtureAsync(options: {
  readonly fixtureRoot: string;
  readonly repositoryRoot: string;
  readonly studioSpecifier?: string;
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
  if (options.studioSpecifier !== undefined) {
    await replaceStudioSpecifierAsync(options.fixtureRoot, options.studioSpecifier);
  }
}

/*** Replace the fixture-only Studio dependency without changing the checked-in standalone consumer manifest. */
async function replaceStudioSpecifierAsync(
  fixtureRoot: string,
  studioSpecifier: string,
): Promise<void> {
  const packagePath = path.join(fixtureRoot, 'package.json');
  const packageJson = JSON.parse(await readFile(packagePath, 'utf8')) as {
    readonly dependencies?: Record<string, string>;
  };
  if (packageJson.dependencies?.['@ankhorage/studio'] === undefined) {
    throw new Error('Standalone Studio fixture does not declare @ankhorage/studio.');
  }
  await writeFile(
    packagePath,
    `${JSON.stringify(
      {
        ...packageJson,
        dependencies: { ...packageJson.dependencies, '@ankhorage/studio': studioSpecifier },
      },
      null,
      2,
    )}\n`,
  );
}
