import { isMissingPathError, writeJsonFileAtomic } from '@ankhorage/utility/node/fs';
import { normalizePortablePath, resolvePathWithinRoot } from '@ankhorage/utility/node/path';
import { isRecord } from '@ankhorage/utility/object';
import { promises as fs } from 'fs';

const RUNTIME_ARTIFACT_LEDGER_REL_PATH = '.ankh/runtime-artifact-ledger.json';
const RUNTIME_CAPABILITY_EXECUTOR_PATH = 'src/generated/runtimeCapabilityExecutor.ts';

interface RuntimeArtifactLedger {
  readonly schemaVersion: 1;
  readonly generatedAt: string;
  readonly files: readonly string[];
}

/*** Own the generated Runtime executor separately from route generation, so its lifecycle cannot widen route ownership. */
export class GeneratedRuntimeArtifactOwnership {
  /*** Identify the sole Runtime artifact owned by this generator lifecycle. */
  static isGeneratedRuntimeArtifactPath(relativePath: string): boolean {
    return normalizePortablePath(relativePath) === RUNTIME_CAPABILITY_EXECUTOR_PATH;
  }

  /*** Initialize Runtime artifact ownership for a newly generated project. */
  async initialize(projectPath: string, generatedPaths: readonly string[]): Promise<void> {
    await assertRuntimeArtifactLedgerMissing(projectPath);
    await writeRuntimeArtifactLedger(
      projectPath,
      createRuntimeArtifactLedger(projectPath, generatedPaths),
    );
  }

  /*** Reconcile generated Runtime artifacts by deleting only stale executor files recorded in this owner ledger. */
  async reconcile(projectPath: string, generatedPaths: readonly string[]): Promise<void> {
    const nextLedger = createRuntimeArtifactLedger(projectPath, generatedPaths);
    const previousLedger = await readRuntimeArtifactLedgerOrInitialize(projectPath, nextLedger);
    const nextFiles = new Set(nextLedger.files);

    for (const relativePath of previousLedger.files) {
      if (nextFiles.has(relativePath)) continue;
      await fs.rm(resolveRuntimeArtifactFile(projectPath, relativePath), { force: true });
    }

    await writeRuntimeArtifactLedger(projectPath, nextLedger);
  }
}

/*** Require the Runtime artifact ledger to be absent before first ownership initialization. */
async function assertRuntimeArtifactLedgerMissing(projectPath: string): Promise<void> {
  const ledgerPath = resolveProjectFile(projectPath, RUNTIME_ARTIFACT_LEDGER_REL_PATH);
  try {
    await fs.access(ledgerPath);
  } catch (error) {
    if (isMissingPathError(error)) return;
    throw error;
  }

  throw new Error(`Project Runtime artifact ownership state already exists at '${ledgerPath}'.`);
}

/*** Create canonical Runtime artifact ownership state after validating the exact generated executor path. */
function createRuntimeArtifactLedger(
  projectPath: string,
  generatedPaths: readonly string[],
): RuntimeArtifactLedger {
  const files = [...new Set(generatedPaths.map(normalizePortablePath))].sort();
  for (const filePath of files) resolveRuntimeArtifactFile(projectPath, filePath);
  return {
    schemaVersion: 1,
    generatedAt: new Date().toISOString(),
    files,
  };
}

/*** Validate the persisted Runtime artifact ledger contract before cleanup. */
function isRuntimeArtifactLedger(value: unknown): value is RuntimeArtifactLedger {
  return (
    isRecord(value) &&
    value.schemaVersion === 1 &&
    typeof value.generatedAt === 'string' &&
    value.generatedAt.length > 0 &&
    Array.isArray(value.files) &&
    value.files.every((filePath) => typeof filePath === 'string')
  );
}

/*** Read the Runtime artifact ledger, initializing it from the current generated output for pre-ledger projects. */
async function readRuntimeArtifactLedgerOrInitialize(
  projectPath: string,
  initialLedger: RuntimeArtifactLedger,
): Promise<RuntimeArtifactLedger> {
  const ledgerPath = resolveProjectFile(projectPath, RUNTIME_ARTIFACT_LEDGER_REL_PATH);
  let source: string;
  try {
    source = await fs.readFile(ledgerPath, 'utf8');
  } catch (error) {
    if (isMissingPathError(error)) return initialLedger;
    throw error;
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(source) as unknown;
  } catch (error) {
    throw new Error(`Project Runtime artifact ownership state is invalid at '${ledgerPath}'.`, {
      cause: error,
    });
  }

  if (!isRuntimeArtifactLedger(parsed)) {
    throw new Error(`Project Runtime artifact ownership state is invalid at '${ledgerPath}'.`);
  }

  const files = parsed.files.map(normalizePortablePath);
  try {
    for (const filePath of files) resolveRuntimeArtifactFile(projectPath, filePath);
  } catch (error) {
    throw new Error(`Project Runtime artifact ownership state is invalid at '${ledgerPath}'.`, {
      cause: error,
    });
  }
  return { ...parsed, files };
}

/*** Resolve the exact generated Runtime executor and reject every other generated path. */
function resolveRuntimeArtifactFile(projectPath: string, relativePath: string): string {
  const target = resolveProjectFile(projectPath, relativePath);
  if (!GeneratedRuntimeArtifactOwnership.isGeneratedRuntimeArtifactPath(relativePath)) {
    throw new Error(`Path is outside current Runtime artifact ownership: ${relativePath}`);
  }
  return target;
}

/*** Resolve a relative Runtime artifact path beneath its project root. */
function resolveProjectFile(projectPath: string, relativePath: string): string {
  try {
    return resolvePathWithinRoot(projectPath, relativePath);
  } catch {
    throw new Error(`Invalid generated Runtime artifact ownership path: ${relativePath}`);
  }
}

/*** Persist Runtime artifact ownership atomically. */
async function writeRuntimeArtifactLedger(
  projectPath: string,
  ledger: RuntimeArtifactLedger,
): Promise<void> {
  await writeJsonFileAtomic(
    resolveProjectFile(projectPath, RUNTIME_ARTIFACT_LEDGER_REL_PATH),
    ledger,
  );
}
