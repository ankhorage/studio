import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';

const STUDIO_PACKAGE_NAME = '@ankhorage/studio';

export function resolveWorkspaceRoot(fromDir: string, cwd = process.cwd()) {
  const candidates = [cwd, fromDir];
  for (const candidate of candidates) {
    const resolved = findStudioWorkspaceRoot(candidate);
    if (resolved !== null) return resolved;
  }
  throw new Error(
    `Could not resolve an ${STUDIO_PACKAGE_NAME} workspace from ${path.resolve(fromDir)} or ${path.resolve(cwd)}.`,
  );
}

function findStudioWorkspaceRoot(startPath: string): string | null {
  let current = path.resolve(startPath);
  for (;;) {
    const packageJsonPath = path.join(current, 'package.json');
    if (existsSync(packageJsonPath) && existsSync(path.join(current, 'apps'))) {
      try {
        const packageJson = JSON.parse(readFileSync(packageJsonPath, 'utf8')) as { name?: unknown };
        if (packageJson.name === STUDIO_PACKAGE_NAME) return current;
      } catch {
        // Continue walking when a parent package.json is not valid JSON.
      }
    }
    const parent = path.dirname(current);
    if (parent === current) return null;
    current = parent;
  }
}
