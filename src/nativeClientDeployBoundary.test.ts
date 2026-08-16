import { readdir, readFile } from 'node:fs/promises';
import { join, relative } from 'node:path';

import { describe, expect, it } from 'bun:test';
import * as ts from 'typescript';

const NODE_ONLY_SOURCE_DIRECTORIES = new Set(['cli', 'host']);
const DEPLOY_PACKAGE_PREFIX = '@ankhorage/deploy';

describe('native Studio Deploy boundary', () => {
  it('keeps Deploy runtime imports out of client-bundled source', async () => {
    const sourceRoot = join(process.cwd(), 'src');
    const files = await collectClientSourceFiles(sourceRoot, sourceRoot);
    const violations: string[] = [];

    for (const file of files) {
      const source = await readFile(file, 'utf8');
      const ast = ts.createSourceFile(
        file,
        source,
        ts.ScriptTarget.Latest,
        true,
        ts.ScriptKind.TSX,
      );
      if (hasDeployRuntimeDependency(ast)) {
        violations.push(relative(process.cwd(), file));
      }
    }

    expect(violations).toEqual([]);
  });
});

async function collectClientSourceFiles(root: string, directory: string): Promise<string[]> {
  const entries = await readdir(directory, { withFileTypes: true });
  const files: string[] = [];

  for (const entry of entries) {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) {
      if (directory === root && NODE_ONLY_SOURCE_DIRECTORIES.has(entry.name)) continue;
      files.push(...(await collectClientSourceFiles(root, path)));
      continue;
    }
    if (
      !entry.isFile() ||
      !/\.(?:ts|tsx)$/.test(entry.name) ||
      /\.test\.(?:ts|tsx)$/.test(entry.name)
    ) {
      continue;
    }
    files.push(path);
  }

  return files;
}

function hasDeployRuntimeDependency(source: ts.SourceFile): boolean {
  return source.statements.some((statement) => {
    if (ts.isImportDeclaration(statement) && isDeploySpecifier(statement.moduleSpecifier)) {
      return hasRuntimeImport(statement.importClause);
    }
    if (ts.isExportDeclaration(statement) && statement.moduleSpecifier) {
      return isDeploySpecifier(statement.moduleSpecifier) && !statement.isTypeOnly;
    }
    return false;
  });
}

function hasRuntimeImport(clause: ts.ImportClause | undefined): boolean {
  if (!clause) return true;
  if (clause.isTypeOnly) return false;
  if (clause.name) return true;
  const bindings = clause.namedBindings;
  if (!bindings) return false;
  if (ts.isNamespaceImport(bindings)) return true;
  return bindings.elements.some((element) => !element.isTypeOnly);
}

function isDeploySpecifier(node: ts.Expression): boolean {
  return ts.isStringLiteral(node) && node.text.startsWith(DEPLOY_PACKAGE_PREFIX);
}
