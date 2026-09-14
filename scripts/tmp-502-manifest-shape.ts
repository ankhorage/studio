import { readdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import ts from 'typescript';

const ROOT = path.resolve('src');
const printer = ts.createPrinter({ newLine: ts.NewLineKind.LineFeed });
const factory = ts.factory;
const ROOT_INFRA_KEYS = new Set(['apis', 'modules', 'modulesConfig']);
const ENV_INFRA_KEYS = new Set([
  'auth',
  'database',
  'deployment',
  'networking',
  'secretStore',
  'storage',
]);

interface Replacement {
  readonly start: number;
  readonly end: number;
  readonly text: string;
}

async function collectFiles(directory: string): Promise<string[]> {
  const entries = await readdir(directory, { withFileTypes: true });
  return (
    await Promise.all(
      entries.map(async (entry) => {
        const absolutePath = path.join(directory, entry.name);
        if (entry.isDirectory()) return collectFiles(absolutePath);
        return /\.tsx?$/u.test(entry.name) ? [absolutePath] : [];
      }),
    )
  ).flat();
}

function propertyName(property: ts.ObjectLiteralElementLike): string | null {
  if (!('name' in property) || !property.name) return null;
  if (ts.isIdentifier(property.name) || ts.isStringLiteral(property.name)) return property.name.text;
  return null;
}

function findProperty(
  object: ts.ObjectLiteralExpression,
  name: string,
): ts.PropertyAssignment | undefined {
  return object.properties.find(
    (property): property is ts.PropertyAssignment =>
      ts.isPropertyAssignment(property) && propertyName(property) === name,
  );
}

function createDefaultDeployment(): ts.ObjectLiteralExpression {
  return factory.createObjectLiteralExpression(
    [
      factory.createPropertyAssignment(
        'compute',
        factory.createObjectLiteralExpression(
          [factory.createPropertyAssignment('provider', factory.createStringLiteral('local'))],
          false,
        ),
      ),
      factory.createPropertyAssignment(
        'runtime',
        factory.createObjectLiteralExpression(
          [factory.createPropertyAssignment('provider', factory.createStringLiteral('minikube'))],
          false,
        ),
      ),
    ],
    true,
  );
}

function migrateDeployment(property: ts.PropertyAssignment): ts.PropertyAssignment {
  if (!ts.isObjectLiteralExpression(property.initializer)) {
    throw new Error('Infra deployment migration requires an object literal.');
  }
  const target = findProperty(property.initializer, 'target');
  const runtimeProvider =
    target && ts.isStringLiteral(target.initializer) ? target.initializer.text : 'minikube';
  return factory.createPropertyAssignment(
    'deployment',
    factory.createObjectLiteralExpression(
      [
        factory.createPropertyAssignment(
          'compute',
          factory.createObjectLiteralExpression(
            [factory.createPropertyAssignment('provider', factory.createStringLiteral('local'))],
            false,
          ),
        ),
        factory.createPropertyAssignment(
          'runtime',
          factory.createObjectLiteralExpression(
            [
              factory.createPropertyAssignment(
                'provider',
                factory.createStringLiteral(runtimeProvider),
              ),
            ],
            false,
          ),
        ),
      ],
      true,
    ),
  );
}

function migrateStorage(property: ts.PropertyAssignment): ts.PropertyAssignment {
  if (!ts.isObjectLiteralExpression(property.initializer)) {
    return factory.createPropertyAssignment('objectStorage', property.initializer);
  }
  const properties = property.initializer.properties.map((entry) => {
    if (!ts.isPropertyAssignment(entry) || propertyName(entry) !== 'provider') return entry;
    if (ts.isStringLiteral(entry.initializer) && entry.initializer.text === 'auto') {
      return factory.createPropertyAssignment('provider', factory.createStringLiteral('supabase'));
    }
    return entry;
  });
  return factory.createPropertyAssignment(
    'objectStorage',
    factory.createObjectLiteralExpression(properties, true),
  );
}

function migrateNetworking(property: ts.PropertyAssignment): ts.PropertyAssignment {
  if (!ts.isObjectLiteralExpression(property.initializer)) return property;
  return factory.createPropertyAssignment(
    'networking',
    factory.createObjectLiteralExpression(
      property.initializer.properties.filter((entry) => propertyName(entry) !== 'cdn'),
      true,
    ),
  );
}

function migrateAuth(property: ts.PropertyAssignment): {
  readonly auth: ts.PropertyAssignment;
  readonly authz?: ts.PropertyAssignment;
} {
  if (!ts.isObjectLiteralExpression(property.initializer)) return { auth: property };
  const authorization = findProperty(property.initializer, 'authorization');
  const auth = factory.createPropertyAssignment(
    'auth',
    factory.createObjectLiteralExpression(
      property.initializer.properties.filter((entry) => propertyName(entry) !== 'authorization'),
      true,
    ),
  );
  if (!authorization || !ts.isObjectLiteralExpression(authorization.initializer)) return { auth };
  const engine = findProperty(authorization.initializer, 'engine');
  if (engine && ts.isStringLiteral(engine.initializer) && engine.initializer.text === 'native') {
    return { auth };
  }
  if (!engine || !ts.isStringLiteral(engine.initializer) || engine.initializer.text !== 'cerbos') {
    throw new Error(`Unsupported legacy authz engine: ${engine?.initializer.getText() ?? 'missing'}`);
  }
  const kind = findProperty(authorization.initializer, 'kind');
  return {
    auth,
    authz: factory.createPropertyAssignment(
      'authz',
      factory.createObjectLiteralExpression(
        [
          factory.createPropertyAssignment('provider', factory.createStringLiteral('cerbos')),
          ...(kind ? [factory.createPropertyAssignment('kind', kind.initializer)] : []),
        ],
        true,
      ),
    ),
  };
}

function migrateInfraObject(object: ts.ObjectLiteralExpression): ts.ObjectLiteralExpression | null {
  const names = object.properties.map(propertyName);
  if (names.includes('environments') || !names.includes('modules')) return null;
  if (object.properties.some(ts.isSpreadAssignment)) return null;

  const rootProperties: ts.ObjectLiteralElementLike[] = [];
  const environmentProperties: ts.ObjectLiteralElementLike[] = [];
  let hasDeployment = false;

  for (const property of object.properties) {
    const name = propertyName(property);
    if (name && ROOT_INFRA_KEYS.has(name)) {
      rootProperties.push(property);
      continue;
    }
    if (!name || !ENV_INFRA_KEYS.has(name) || !ts.isPropertyAssignment(property)) {
      throw new Error(`Unsupported legacy Infra property: ${name ?? property.getText()}`);
    }
    if (name === 'deployment') {
      environmentProperties.push(migrateDeployment(property));
      hasDeployment = true;
      continue;
    }
    if (name === 'storage') {
      environmentProperties.push(migrateStorage(property));
      continue;
    }
    if (name === 'networking') {
      environmentProperties.push(migrateNetworking(property));
      continue;
    }
    if (name === 'auth') {
      const migrated = migrateAuth(property);
      environmentProperties.push(migrated.auth);
      if (migrated.authz) environmentProperties.push(migrated.authz);
      continue;
    }
    environmentProperties.push(property);
  }

  if (!hasDeployment) {
    environmentProperties.unshift(
      factory.createPropertyAssignment('deployment', createDefaultDeployment()),
    );
  }

  return factory.createObjectLiteralExpression(
    [
      factory.createPropertyAssignment(
        'environments',
        factory.createObjectLiteralExpression(
          [
            factory.createPropertyAssignment(
              'local',
              factory.createObjectLiteralExpression(environmentProperties, true),
            ),
          ],
          true,
        ),
      ),
      ...rootProperties,
    ],
    true,
  );
}

function collectInfraReplacements(sourceFile: ts.SourceFile): Replacement[] {
  const replacements: Replacement[] = [];
  const visit = (node: ts.Node): void => {
    if (
      ts.isPropertyAssignment(node) &&
      propertyName(node) === 'infra' &&
      ts.isObjectLiteralExpression(node.initializer)
    ) {
      const migrated = migrateInfraObject(node.initializer);
      if (migrated) {
        replacements.push({
          start: node.initializer.getStart(sourceFile),
          end: node.initializer.getEnd(),
          text: printer.printNode(ts.EmitHint.Expression, migrated, sourceFile),
        });
      }
    }
    ts.forEachChild(node, visit);
  };
  visit(sourceFile);
  return replacements;
}

function applyReplacements(source: string, replacements: readonly Replacement[]): string {
  return [...replacements]
    .sort((left, right) => right.start - left.start)
    .reduce(
      (current, replacement) =>
        `${current.slice(0, replacement.start)}${replacement.text}${current.slice(replacement.end)}`,
      source,
    );
}

function migratePropertyAccess(source: string): string {
  return source
    .replaceAll('.infra.auth', '.infra.environments.local.auth')
    .replaceAll('.infra.database', '.infra.environments.local.database')
    .replaceAll('.infra.storage', '.infra.environments.local.objectStorage')
    .replaceAll('.infra.networking', '.infra.environments.local.networking')
    .replaceAll('.infra.secretStore', '.infra.environments.local.secretStore')
    .replaceAll('.infra.deployment', '.infra.environments.local.deployment');
}

async function migrateFile(filePath: string): Promise<void> {
  const original = await readFile(filePath, 'utf8');
  const sourceFile = ts.createSourceFile(
    filePath,
    original,
    ts.ScriptTarget.Latest,
    true,
    filePath.endsWith('.tsx') ? ts.ScriptKind.TSX : ts.ScriptKind.TS,
  );
  const migrated = migratePropertyAccess(
    applyReplacements(original, collectInfraReplacements(sourceFile)),
  );
  if (migrated !== original) await writeFile(filePath, migrated, 'utf8');
}

await Promise.all((await collectFiles(ROOT)).map(migrateFile));
