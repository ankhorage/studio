import { promises as fs } from 'fs';
import path from 'path';

const ROUTE_LEDGER_REL_PATH = '.ankh/route-ledger.json';
const ROUTE_ROOT_REL_PATH = 'src/app';

interface RouteLedger {
  schemaVersion: 1;
  generatedAt: string;
  files: string[];
}

export async function syncGeneratedRouteFiles(args: {
  projectPath: string;
  generatedPaths: string[];
}) {
  const { projectPath, generatedPaths } = args;

  const nextFiles = new Set(generatedPaths.map((filePath) => normalizeRel(filePath)));
  const previousLedger = await readRouteLedger(projectPath);
  const previousFiles = new Set(
    (previousLedger?.files ?? []).map((filePath) => normalizeRel(filePath)),
  );

  if (previousLedger) {
    const staleFiles = new Set([...previousFiles].filter((filePath) => !nextFiles.has(filePath)));
    await removeFiles(projectPath, staleFiles);
  } else {
    await removeOrphanedGeneratedScreenFiles(projectPath, nextFiles);
  }

  await writeRouteLedger(projectPath, {
    schemaVersion: 1,
    generatedAt: new Date().toISOString(),
    files: [...nextFiles].sort(),
  });
}

async function removeOrphanedGeneratedScreenFiles(
  projectPath: string,
  generatedFiles: Set<string>,
) {
  const appRoot = resolveProjectFile(projectPath, ROUTE_ROOT_REL_PATH);
  if (!(await exists(appRoot))) return;

  const routeFiles = await listFilesRecursively(appRoot);
  for (const absPath of routeFiles) {
    if (!absPath.endsWith('.tsx')) continue;

    const relPath = normalizeRel(path.relative(projectPath, absPath));
    if (generatedFiles.has(relPath)) continue;

    const content = await fs.readFile(absPath, 'utf8');
    if (!looksLikeGeneratedScreenFile(content)) continue;

    await fs.rm(absPath, { force: true });
  }
}

async function listFilesRecursively(absDir: string): Promise<string[]> {
  const entries = await fs.readdir(absDir, { withFileTypes: true });
  const files: string[] = [];

  for (const entry of entries) {
    const absPath = path.join(absDir, entry.name);
    if (entry.isDirectory()) {
      files.push(...(await listFilesRecursively(absPath)));
    } else if (entry.isFile()) {
      files.push(absPath);
    }
  }

  return files;
}

function looksLikeGeneratedScreenFile(content: string): boolean {
  return (
    content.includes("import ankhConfig from '@root/ankh.config.json';") &&
    content.includes('useOptionalManifestContext') &&
    content.includes('RuntimeRenderer') &&
    content.includes('currentScreenId') &&
    content.includes('Screen configuration not found for ID:')
  );
}

async function readRouteLedger(projectPath: string): Promise<RouteLedger | null> {
  const ledgerPath = resolveProjectFile(projectPath, ROUTE_LEDGER_REL_PATH);

  try {
    const raw = await fs.readFile(ledgerPath, 'utf8');
    const parsed = JSON.parse(raw) as Partial<RouteLedger>;
    if (parsed.schemaVersion !== 1 || !Array.isArray(parsed.files)) {
      return null;
    }

    return {
      schemaVersion: 1,
      generatedAt: typeof parsed.generatedAt === 'string' ? parsed.generatedAt : '',
      files: parsed.files.filter((file): file is string => typeof file === 'string'),
    };
  } catch {
    return null;
  }
}

async function writeRouteLedger(projectPath: string, ledger: RouteLedger) {
  const ledgerPath = resolveProjectFile(projectPath, ROUTE_LEDGER_REL_PATH);
  await fs.mkdir(path.dirname(ledgerPath), { recursive: true });
  await fs.writeFile(ledgerPath, JSON.stringify(ledger, null, 2), 'utf8');
}

async function removeFiles(projectPath: string, files: Set<string>) {
  for (const relPath of files) {
    const absPath = resolveProjectFile(projectPath, relPath);
    try {
      await fs.rm(absPath, { force: true });
    } catch {
      // Best-effort cleanup of stale generated route files.
    }
  }
}

function resolveProjectFile(projectPath: string, relPath: string) {
  const root = path.resolve(projectPath);
  const absPath = path.resolve(root, relPath);
  const relative = path.relative(root, absPath);
  const isInsideProject =
    relative === '' || (!relative.startsWith('..') && !path.isAbsolute(relative));

  if (!isInsideProject) {
    throw new Error(`Invalid route path outside project root: ${relPath}`);
  }

  return absPath;
}

function normalizeRel(filePath: string) {
  return filePath.replace(/\\/g, '/');
}

async function exists(absPath: string) {
  try {
    await fs.access(absPath);
    return true;
  } catch {
    return false;
  }
}
