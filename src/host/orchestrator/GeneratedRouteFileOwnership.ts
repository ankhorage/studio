import { promises as fs } from 'fs';
import path from 'path';

const ROUTE_LEDGER_REL_PATH = '.ankh/route-ledger.json';
const GENERATED_AUTH_FILE_PATHS = new Set([
  'src/auth/adapter.ts',
  'src/auth/form.ts',
  'src/auth/navigation.ts',
  'src/auth/oauth-completion.ts',
  'src/auth/oauth-state.ts',
  'src/auth/oauth.ts',
  'src/auth/screen-controller.ts',
  'src/auth/session.ts',
  'src/screens/auth-screen.tsx',
]);

interface RouteLedger {
  readonly schemaVersion: 1;
  readonly generatedAt: string;
  readonly files: readonly string[];
}

export class GeneratedRouteFileOwnership {
  async assertSyncable(projectPath: string): Promise<void> {
    await readRequiredRouteLedger(projectPath);
  }

  async initialize(projectPath: string, generatedPaths: readonly string[]): Promise<void> {
    await assertRouteLedgerMissing(projectPath);
    await writeRouteLedger(projectPath, createRouteLedger(projectPath, generatedPaths));
  }

  async reconcile(projectPath: string, generatedPaths: readonly string[]): Promise<void> {
    const previousLedger = await readRequiredRouteLedger(projectPath);
    const nextLedger = createRouteLedger(projectPath, generatedPaths);
    const nextFiles = new Set(nextLedger.files);

    for (const relativePath of previousLedger.files) {
      if (nextFiles.has(relativePath)) continue;
      await fs.rm(resolveGeneratedFile(projectPath, relativePath), { force: true });
    }

    await writeRouteLedger(projectPath, nextLedger);
  }
}

async function assertRouteLedgerMissing(projectPath: string): Promise<void> {
  const ledgerPath = resolveProjectFile(projectPath, ROUTE_LEDGER_REL_PATH);
  try {
    await fs.access(ledgerPath);
  } catch (error) {
    if (isMissingPathError(error)) return;
    throw error;
  }

  throw new Error(`Project route ownership state already exists at '${ledgerPath}'.`);
}

function createRouteLedger(projectPath: string, generatedPaths: readonly string[]): RouteLedger {
  const files = [...new Set(generatedPaths.map(normalizeRelativePath))].sort();
  for (const filePath of files) resolveGeneratedFile(projectPath, filePath);
  return {
    schemaVersion: 1,
    generatedAt: new Date().toISOString(),
    files,
  };
}

function isMissingPathError(error: unknown): error is NodeJS.ErrnoException {
  return error instanceof Error && 'code' in error && error.code === 'ENOENT';
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function isRouteLedger(value: unknown): value is RouteLedger {
  return (
    isRecord(value) &&
    value.schemaVersion === 1 &&
    typeof value.generatedAt === 'string' &&
    value.generatedAt.length > 0 &&
    Array.isArray(value.files) &&
    value.files.every((filePath) => typeof filePath === 'string')
  );
}

function normalizeRelativePath(filePath: string): string {
  return path.posix.normalize(filePath.replace(/\\/gu, '/'));
}

async function readRequiredRouteLedger(projectPath: string): Promise<RouteLedger> {
  const ledgerPath = resolveProjectFile(projectPath, ROUTE_LEDGER_REL_PATH);
  let source: string;
  try {
    source = await fs.readFile(ledgerPath, 'utf8');
  } catch (error) {
    if (isMissingPathError(error)) {
      throw new Error(`Project route ownership state is missing at '${ledgerPath}'.`, {
        cause: error,
      });
    }
    throw error;
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(source) as unknown;
  } catch (error) {
    throw new Error(`Project route ownership state is invalid at '${ledgerPath}'.`, {
      cause: error,
    });
  }

  if (!isRouteLedger(parsed)) {
    throw new Error(`Project route ownership state is invalid at '${ledgerPath}'.`);
  }

  const files = parsed.files.map(normalizeRelativePath);
  try {
    for (const filePath of files) resolveGeneratedFile(projectPath, filePath);
  } catch (error) {
    throw new Error(`Project route ownership state is invalid at '${ledgerPath}'.`, {
      cause: error,
    });
  }
  return { ...parsed, files };
}

function resolveGeneratedFile(projectPath: string, relativePath: string): string {
  const target = resolveProjectFile(projectPath, relativePath);
  const isGeneratedAppRoute = relativePath.startsWith('src/app/') && relativePath.endsWith('.tsx');
  if (!isGeneratedAppRoute && !GENERATED_AUTH_FILE_PATHS.has(relativePath)) {
    throw new Error(`Path is outside current route-generation ownership: ${relativePath}`);
  }
  return target;
}

function resolveProjectFile(projectPath: string, relativePath: string): string {
  if (path.isAbsolute(relativePath)) {
    throw new Error(`Invalid generated route ownership path: ${relativePath}`);
  }
  const root = path.resolve(projectPath);
  const target = path.resolve(root, relativePath);
  const relative = path.relative(root, target);
  if (relative === '' || relative.startsWith('..') || path.isAbsolute(relative)) {
    throw new Error(`Invalid generated route ownership path: ${relativePath}`);
  }
  return target;
}

async function writeRouteLedger(projectPath: string, ledger: RouteLedger): Promise<void> {
  const ledgerPath = resolveProjectFile(projectPath, ROUTE_LEDGER_REL_PATH);
  await fs.mkdir(path.dirname(ledgerPath), { recursive: true });
  const temporaryPath = `${ledgerPath}.${process.pid}.${Date.now()}.tmp`;
  await fs.writeFile(temporaryPath, `${JSON.stringify(ledger, null, 2)}\n`, 'utf8');
  await fs.rename(temporaryPath, ledgerPath);
}
