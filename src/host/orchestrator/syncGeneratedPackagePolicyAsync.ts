import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';

import { applyGeneratedPackagePolicy } from './applyGeneratedPackagePolicy';

/*** Reconcile one generated app package manifest against current owner-managed version ranges. */
export async function syncGeneratedPackagePolicyAsync(projectPath: string): Promise<void> {
  const packageJsonPath = path.join(projectPath, 'package.json');
  const source = await readFile(packageJsonPath, 'utf8');
  const packageJson: unknown = JSON.parse(source);
  assertGeneratedPackageManifest(packageJson);
  const synchronized = applyGeneratedPackagePolicy(packageJson);
  const nextSource = `${JSON.stringify(synchronized, null, 2)}\n`;
  if (source === nextSource) return;
  await writeFile(packageJsonPath, nextSource, 'utf8');
}

interface GeneratedPackageManifest {
  readonly packageManager: string;
  readonly dependencies: Readonly<Record<string, string>>;
  readonly devDependencies: Readonly<Record<string, string>>;
}

/*** Validate the minimum package shape required by generated dependency reconciliation. */
function assertGeneratedPackageManifest(value: unknown): asserts value is GeneratedPackageManifest {
  if (!isRecord(value)) throw new Error('Generated package.json must contain an object.');
  if (typeof value.packageManager !== 'string') {
    throw new Error('Generated package.json must define packageManager.');
  }
  if (!isStringRecord(value.dependencies)) {
    throw new Error('Generated package.json must define string dependencies.');
  }
  if (!isStringRecord(value.devDependencies)) {
    throw new Error('Generated package.json must define string devDependencies.');
  }
}

/*** Return whether a value is a non-array object. */
function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/*** Return whether a value is an object whose own values are strings. */
function isStringRecord(value: unknown): value is Record<string, string> {
  return isRecord(value) && Object.values(value).every((entry) => typeof entry === 'string');
}
