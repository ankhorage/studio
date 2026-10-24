import { readFile, writeFile } from 'node:fs/promises';
import process from 'node:process';

import { isRecord } from '@ankhorage/utility/object';
import { compareSemanticVersions, parseSemanticVersion } from '@ankhorage/utility/semver';

interface PackageManifest {
  readonly name: string;
  readonly version?: string;
  readonly dependencies: Readonly<Record<string, string>>;
  readonly devDependencies: Readonly<Record<string, string>>;
}

/*** Reconcile only the first-party app's already declared owner dependency floors after an npm-verified Studio release. */
export function reconcileStudioConsumerManifest(
  root: PackageManifest,
  app: PackageManifest,
  publishedVersion: string,
): PackageManifest {
  if (root.name !== '@ankhorage/studio' || root.version !== publishedVersion) {
    throw new Error('Studio root version must exactly match the verified npm release.');
  }
  if (app.name !== '@ankhorage/studio-app') {
    throw new Error('Unexpected first-party Studio consumer.');
  }
  if (!Object.hasOwn(app.dependencies, '@ankhorage/studio')) {
    throw new Error('The first-party consumer must directly depend on @ankhorage/studio.');
  }

  const owners = new Map(
    Object.entries({
      ...root.dependencies,
      ...root.devDependencies,
      '@ankhorage/studio': `^${publishedVersion}`,
    }),
  );
  const reconcile = (declared: Readonly<Record<string, string>>): Record<string, string> =>
    Object.fromEntries(
      Object.entries(declared).map(([name, range]) => {
        const required = owners.get(name);
        return [
          name,
          name.startsWith('@ankhorage/') && required !== undefined
            ? selectMonotonicOwnerRange(name, range, required)
            : range,
        ];
      }),
    );

  return {
    ...app,
    dependencies: reconcile(app.dependencies),
    devDependencies: reconcile(app.devDependencies),
  };
}

/*** Select the newer supported caret/tilde semver floor without downgrading direct consumer requirements. */
function selectMonotonicOwnerRange(name: string, existing: string, required: string): string {
  /*** Parse the explicitly supported owner-managed caret or tilde range floor. */
  const floor = (range: string) => {
    const match = /^(?:\^|~)(\d+\.\d+\.\d+)$/.exec(range);
    if (!match) throw new Error(`Unsupported owner range for ${name}: ${range}`);
    const version = parseSemanticVersion(match[1] ?? '');
    if (version === null) throw new Error(`Unparseable owner range for ${name}: ${range}`);
    return version;
  };
  return compareSemanticVersions(floor(existing), floor(required)) >= 0 ? existing : required;
}

/*** Require valid owner dependency records without trusting arbitrary JSON input. */
function isStringRecord(value: unknown): value is Record<string, string> {
  return isRecord(value) && Object.values(value).every((entry) => typeof entry === 'string');
}

/*** Validate the metadata needed for deterministic first-party dependency reconciliation. */
function isPackageManifest(value: unknown): value is PackageManifest {
  return (
    isRecord(value) &&
    typeof value.name === 'string' &&
    (value.version === undefined || typeof value.version === 'string') &&
    isStringRecord(value.dependencies) &&
    isStringRecord(value.devDependencies)
  );
}

if (import.meta.main) {
  const rootPath = 'package.json';
  const appPath = 'apps/studio/package.json';
  const rootValue: unknown = JSON.parse(await readFile(rootPath, 'utf8'));
  const appSource = await readFile(appPath, 'utf8');
  const appValue: unknown = JSON.parse(appSource);
  if (!isPackageManifest(rootValue) || !isPackageManifest(appValue)) {
    throw new Error('Studio root or standalone consumer manifest has an invalid shape.');
  }
  const verifiedVersion = process.env.STUDIO_PUBLISHED_VERSION;
  if (!verifiedVersion) {
    throw new Error('STUDIO_PUBLISHED_VERSION must come from npm publication verification.');
  }
  const next = `${JSON.stringify(reconcileStudioConsumerManifest(rootValue, appValue, verifiedVersion), null, 2)}\n`;
  if (next !== appSource) await writeFile(appPath, next, 'utf8');
}
