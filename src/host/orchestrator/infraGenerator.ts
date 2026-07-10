import type { AppManifest } from '@ankhorage/contracts';
import { generateInfrastructure } from '@ankhorage/infra';
import { promises as fs } from 'fs';
import path from 'path';

import { validateInfraSupport } from './infraValidation';

const INFRA_LEDGER_REL_PATH = '.ankh/infra-ledger.json';
const STUDIO_PROJECT_ID = 'studio';
type InfrastructureGenerator = typeof generateInfrastructure;

interface InfraLedger {
  schemaVersion: 1;
  generatedAt: string;
  target: string;
  files: string[];
  warnings: string[];
}

export interface InfraSyncResult {
  generated: number;
  removed: number;
  warnings: string[];
  skipped?: {
    reason: string;
  };
}

export interface InfraStatusResult {
  target: string | null;
  hasDeployment: boolean;
  hasLedger: boolean;
  trackedFiles: number;
  generatedAt: string | null;
  warnings: string[];
  skipped?: {
    reason: string;
  };
}

export async function syncProjectInfrastructure(args: {
  projectId: string;
  projectPath: string;
  manifest: AppManifest;
  generateInfrastructureImpl?: InfrastructureGenerator;
}): Promise<InfraSyncResult> {
  const { projectId, projectPath, manifest, generateInfrastructureImpl } = args;
  const supportWarnings = validateInfraSupport(manifest.infra);

  if (projectId === STUDIO_PROJECT_ID) {
    return {
      generated: 0,
      removed: 0,
      warnings: supportWarnings,
      skipped: {
        reason: 'apps/studio is the dashboard and is not a generated app target.',
      },
    };
  }

  const previousLedger = await readInfraLedger(projectPath);
  const previousFiles = new Set(previousLedger?.files ?? []);

  if (!manifest.infra.deployment) {
    const removed = await removeFiles(projectPath, previousFiles);
    await removeInfraLedger(projectPath);
    return { generated: 0, removed, warnings: supportWarnings };
  }

  const generated = (generateInfrastructureImpl ?? generateInfrastructure)(manifest.infra, {
    namespaceHint: projectId,
    appManifest: manifest,
  });
  const combinedWarnings = unique([...supportWarnings, ...generated.warnings]);
  const nextFiles = new Set<string>();

  for (const file of generated.files) {
    const absPath = resolveProjectFile(projectPath, file.path);
    await fs.mkdir(path.dirname(absPath), { recursive: true });
    await fs.writeFile(absPath, file.content, 'utf8');
    if (file.executable) {
      await fs.chmod(absPath, 0o755);
    }
    nextFiles.add(file.path);
  }

  const staleFiles = new Set([...previousFiles].filter((f) => !nextFiles.has(f)));
  const removed = await removeFiles(projectPath, staleFiles);

  await writeInfraLedger(projectPath, {
    schemaVersion: 1,
    generatedAt: new Date().toISOString(),
    target: generated.meta.target,
    files: [...nextFiles].sort(),
    warnings: combinedWarnings,
  });

  return {
    generated: generated.files.length,
    removed,
    warnings: combinedWarnings,
  };
}

export async function getProjectInfrastructureStatus(args: {
  projectId: string;
  projectPath: string;
  manifest: AppManifest;
}): Promise<InfraStatusResult> {
  const { projectId, projectPath, manifest } = args;
  const supportWarnings = validateInfraSupport(manifest.infra);

  if (projectId === STUDIO_PROJECT_ID) {
    return {
      target: null,
      hasDeployment: false,
      hasLedger: false,
      trackedFiles: 0,
      generatedAt: null,
      warnings: supportWarnings,
      skipped: {
        reason: 'apps/studio is the dashboard and is not a generated app target.',
      },
    };
  }

  const ledger = await readInfraLedger(projectPath);

  return {
    target: manifest.infra.deployment?.target ?? ledger?.target ?? null,
    hasDeployment: manifest.infra.deployment !== undefined,
    hasLedger: ledger !== null,
    trackedFiles: ledger?.files.length ?? 0,
    generatedAt: ledger?.generatedAt ?? null,
    warnings: unique([...supportWarnings, ...(ledger?.warnings ?? [])]),
  };
}

function resolveProjectFile(projectPath: string, filePath: string): string {
  const root = path.resolve(projectPath);
  const resolved = path.resolve(root, filePath);

  const relative = path.relative(root, resolved);
  if (relative.startsWith('..') || path.isAbsolute(relative)) {
    throw new Error(`Invalid infra output path outside project root: ${filePath}`);
  }

  return resolved;
}

async function readInfraLedger(projectPath: string): Promise<InfraLedger | null> {
  const ledgerPath = path.join(projectPath, INFRA_LEDGER_REL_PATH);
  try {
    const raw = await fs.readFile(ledgerPath, 'utf8');
    const parsed: unknown = JSON.parse(raw);
    if (!isInfraLedger(parsed)) {
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}

async function writeInfraLedger(projectPath: string, ledger: InfraLedger) {
  const ledgerPath = path.join(projectPath, INFRA_LEDGER_REL_PATH);
  await fs.mkdir(path.dirname(ledgerPath), { recursive: true });
  await fs.writeFile(ledgerPath, `${JSON.stringify(ledger, null, 2)}\n`, 'utf8');
}

async function removeInfraLedger(projectPath: string) {
  await fs.rm(path.join(projectPath, INFRA_LEDGER_REL_PATH), { force: true });
}

async function removeFiles(projectPath: string, files: ReadonlySet<string>): Promise<number> {
  let removed = 0;
  for (const file of files) {
    await fs.rm(resolveProjectFile(projectPath, file), { force: true });
    removed += 1;
  }
  return removed;
}

function isInfraLedger(value: unknown): value is InfraLedger {
  return (
    typeof value === 'object' &&
    value !== null &&
    !Array.isArray(value) &&
    (value as Partial<InfraLedger>).schemaVersion === 1 &&
    typeof (value as Partial<InfraLedger>).generatedAt === 'string' &&
    typeof (value as Partial<InfraLedger>).target === 'string' &&
    Array.isArray((value as Partial<InfraLedger>).files) &&
    Array.isArray((value as Partial<InfraLedger>).warnings)
  );
}

function unique(values: readonly string[]): string[] {
  return [...new Set(values)];
}
