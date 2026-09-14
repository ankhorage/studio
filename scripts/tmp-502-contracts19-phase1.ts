import { readdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';

const ROOT = path.resolve('src');
const ENV_IMPORT = "import { APP_ENVIRONMENT_IDS, type AppEnvironmentId } from '@ankhorage/contracts/environments';";

async function collectFiles(directory: string): Promise<string[]> {
  const entries = await readdir(directory, { withFileTypes: true });
  const nested = await Promise.all(
    entries.map(async (entry) => {
      const absolutePath = path.join(directory, entry.name);
      if (entry.isDirectory()) return collectFiles(absolutePath);
      return /\.tsx?$/u.test(entry.name) ? [absolutePath] : [];
    }),
  );
  return nested.flat();
}

function rewriteDeployImports(source: string): string {
  const deployImport = /import \{([\s\S]*?)\} from '@ankhorage\/contracts\/deploy';/gu;
  return source.replace(deployImport, (full, rawNames: string) => {
    const names = rawNames
      .split(',')
      .map((value) => value.trim())
      .filter(Boolean)
      .filter((value) => value !== 'APP_ENVIRONMENT_IDS' && value !== 'type AppEnvironmentId');
    if (names.length === 0) return '';
    return `import {\n  ${names.join(',\n  ')},\n} from '@ankhorage/contracts/deploy';`;
  });
}

function ensureEnvironmentImport(source: string): string {
  if (!source.includes('APP_ENVIRONMENT_IDS') && !source.includes('AppEnvironmentId')) return source;
  if (source.includes("from '@ankhorage/contracts/environments'")) return source;

  const importMatches = [...source.matchAll(/^import .*;$/gmu)];
  const lastImport = importMatches.at(-1);
  if (!lastImport || lastImport.index === undefined) return `${ENV_IMPORT}\n${source}`;
  const end = lastImport.index + lastImport[0].length;
  return `${source.slice(0, end)}\n${ENV_IMPORT}${source.slice(end)}`;
}

async function migrateFile(filePath: string): Promise<void> {
  const original = await readFile(filePath, 'utf8');
  const renamed = original
    .replaceAll('APP_DEPLOY_ENVIRONMENT_IDS', 'APP_ENVIRONMENT_IDS')
    .replaceAll('AppDeployEnvironmentId', 'AppEnvironmentId');
  const rewritten = ensureEnvironmentImport(rewriteDeployImports(renamed));
  if (rewritten !== original) await writeFile(filePath, rewritten, 'utf8');
}

await Promise.all((await collectFiles(ROOT)).map(migrateFile));
