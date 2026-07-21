interface GeneratedNamedImport {
  readonly imported: string;
  readonly local?: string;
  readonly typeOnly?: boolean;
}

export interface GeneratedImportRequirement {
  readonly source: string;
  readonly defaultImport?: string;
  readonly namespaceImport?: string;
  readonly namedImports?: readonly GeneratedNamedImport[];
  readonly sideEffectOnly?: boolean;
  readonly typeOnlyDefaultImport?: string;
  readonly typeOnlyNamespaceImport?: string;
}

export type GeneratedImportInput = GeneratedImportRequirement | string;

interface MutableImportRequirement {
  source: string;
  defaultImport?: string;
  namespaceImport?: string;
  namedImports: Map<string, GeneratedNamedImport>;
  sideEffectOnly: boolean;
  typeOnlyDefaultImport?: string;
  typeOnlyNamespaceImport?: string;
}

const IMPORT_STATEMENT_PATTERN =
  /import\s+(?:type\s+)?[\s\S]*?\s+from\s+(['"])[^'"]+\1\s*;?|import\s+(['"])[^'"]+\2\s*;?/gu;

export function composeGeneratedImports(inputs: readonly GeneratedImportInput[]): string {
  const requirements = inputs.flatMap((input) =>
    typeof input === 'string' ? parseGeneratedImportFragment(input) : [input],
  );
  const merged = mergeGeneratedImportRequirements(requirements);
  return merged.flatMap(renderGeneratedImportRequirement).join('\n');
}

function parseGeneratedImportFragment(fragment: string): GeneratedImportRequirement[] {
  const trimmed = fragment.trim();
  if (trimmed.length === 0) return [];

  const statements = trimmed.match(IMPORT_STATEMENT_PATTERN) ?? [];
  const remainder = statements
    .reduce((value, statement) => value.replace(statement, ''), trimmed)
    .trim();
  if (remainder.length > 0) {
    throw new Error(`Generated import fragment contains unsupported content: ${remainder}`);
  }

  return statements.map(parseGeneratedImportStatement);
}

function parseGeneratedImportStatement(statement: string): GeneratedImportRequirement {
  const sideEffectMatch = statement.match(/^import\s+(['"])([^'"]+)\1\s*;?$/u);
  if (sideEffectMatch) {
    const [, , source] = sideEffectMatch;
    if (!source) throw new Error(`Invalid side-effect import statement: ${statement}`);
    return { source, sideEffectOnly: true };
  }

  const fromMatch = statement.match(/^import\s+([\s\S]+?)\s+from\s+(['"])([^'"]+)\2\s*;?$/u);
  const [, rawClause, , source] = fromMatch ?? [];
  if (!rawClause || !source) {
    throw new Error(`Unsupported generated import statement: ${statement}`);
  }

  const typeOnly = rawClause.startsWith('type ');
  const clause = typeOnly ? rawClause.slice('type '.length).trim() : rawClause.trim();
  return parseImportClause(source, clause, typeOnly);
}

function parseImportClause(
  source: string,
  clause: string,
  typeOnly: boolean,
): GeneratedImportRequirement {
  if (clause.startsWith('{')) {
    return { source, namedImports: parseNamedImports(clause, typeOnly) };
  }

  if (clause.startsWith('* as ')) {
    const local = clause.slice('* as '.length).trim();
    return typeOnly
      ? { source, typeOnlyNamespaceImport: local }
      : { source, namespaceImport: local };
  }

  const commaIndex = clause.indexOf(',');
  if (commaIndex === -1) {
    return typeOnly
      ? { source, typeOnlyDefaultImport: clause }
      : { source, defaultImport: clause };
  }

  const defaultImport = clause.slice(0, commaIndex).trim();
  const remainder = clause.slice(commaIndex + 1).trim();
  const base = typeOnly
    ? { source, typeOnlyDefaultImport: defaultImport }
    : { source, defaultImport };

  if (remainder.startsWith('{')) {
    return { ...base, namedImports: parseNamedImports(remainder, typeOnly) };
  }

  if (remainder.startsWith('* as ')) {
    const local = remainder.slice('* as '.length).trim();
    return typeOnly
      ? { ...base, typeOnlyNamespaceImport: local }
      : { ...base, namespaceImport: local };
  }

  throw new Error(`Unsupported generated import clause: ${clause}`);
}

function parseNamedImports(clause: string, inheritedTypeOnly: boolean): GeneratedNamedImport[] {
  const body = clause.replace(/^\{/u, '').replace(/\}$/u, '').trim();
  if (body.length === 0) return [];

  return body
    .split(',')
    .map((rawSpecifier) => rawSpecifier.trim())
    .filter(Boolean)
    .map((trimmed) => {
      const typeOnly = inheritedTypeOnly || trimmed.startsWith('type ');
      const specifier = trimmed.startsWith('type ')
        ? trimmed.slice('type '.length).trim()
        : trimmed;
      const [rawImported, rawLocal] = specifier.split(/\s+as\s+/u);
      const imported = rawImported?.trim();
      const local = rawLocal?.trim();
      if (!imported) throw new Error(`Invalid generated named import: ${trimmed}`);

      return {
        imported,
        ...(local && local !== imported ? { local } : {}),
        ...(typeOnly ? { typeOnly: true } : {}),
      };
    });
}

function mergeGeneratedImportRequirements(
  requirements: readonly GeneratedImportRequirement[],
): MutableImportRequirement[] {
  const bySource = new Map<string, MutableImportRequirement>();
  const localBindings = new Map<string, string>();

  for (const requirement of requirements) {
    const merged = bySource.get(requirement.source) ?? createMutableRequirement(requirement.source);
    bySource.set(requirement.source, merged);
    merged.sideEffectOnly ||= requirement.sideEffectOnly === true;
    merged.defaultImport = mergeSingleBinding(
      merged.defaultImport,
      requirement.defaultImport,
      requirement.source,
      'default import',
      localBindings,
    );
    merged.typeOnlyDefaultImport = mergeSingleBinding(
      merged.typeOnlyDefaultImport,
      requirement.typeOnlyDefaultImport,
      requirement.source,
      'type-only default import',
      localBindings,
    );
    merged.namespaceImport = mergeSingleBinding(
      merged.namespaceImport,
      requirement.namespaceImport,
      requirement.source,
      'namespace import',
      localBindings,
    );
    merged.typeOnlyNamespaceImport = mergeSingleBinding(
      merged.typeOnlyNamespaceImport,
      requirement.typeOnlyNamespaceImport,
      requirement.source,
      'type-only namespace import',
      localBindings,
    );

    for (const namedImport of requirement.namedImports ?? []) {
      mergeNamedImport(merged, namedImport, localBindings);
    }
  }

  return [...bySource.values()];
}

function createMutableRequirement(source: string): MutableImportRequirement {
  return {
    source,
    namedImports: new Map(),
    sideEffectOnly: false,
  };
}

function mergeSingleBinding(
  current: string | undefined,
  incoming: string | undefined,
  source: string,
  kind: string,
  localBindings: Map<string, string>,
): string | undefined {
  if (!incoming) return current;
  if (current && current !== incoming) {
    throw new Error(`Conflicting ${kind} bindings for '${source}': '${current}' and '${incoming}'.`);
  }
  registerLocalBinding(localBindings, incoming, `${source}:${kind}`);
  return incoming;
}

function mergeNamedImport(
  requirement: MutableImportRequirement,
  incoming: GeneratedNamedImport,
  localBindings: Map<string, string>,
): void {
  const local = incoming.local ?? incoming.imported;
  const existing = requirement.namedImports.get(local);
  if (existing && existing.imported !== incoming.imported) {
    throw new Error(
      `Conflicting named import binding '${local}' for '${requirement.source}': ` +
        `'${existing.imported}' and '${incoming.imported}'.`,
    );
  }

  registerLocalBinding(localBindings, local, `${requirement.source}:${incoming.imported}`);
  requirement.namedImports.set(local, {
    imported: incoming.imported,
    ...(incoming.local ? { local: incoming.local } : {}),
    ...((existing?.typeOnly === false || incoming.typeOnly === false)
      ? { typeOnly: false }
      : incoming.typeOnly === true || existing?.typeOnly === true
        ? { typeOnly: true }
        : {}),
  });
}

function registerLocalBinding(bindings: Map<string, string>, local: string, owner: string): void {
  const existing = bindings.get(local);
  if (existing && existing !== owner) {
    throw new Error(`Generated imports bind '${local}' more than once: '${existing}' and '${owner}'.`);
  }
  bindings.set(local, owner);
}

function renderGeneratedImportRequirement(requirement: MutableImportRequirement): string[] {
  const statements: string[] = [];
  const valueNamed = [...requirement.namedImports.values()].filter((entry) => entry.typeOnly !== true);
  const typeNamed = [...requirement.namedImports.values()].filter((entry) => entry.typeOnly === true);

  if (requirement.namespaceImport) {
    statements.push(
      renderImportStatement(
        requirement.source,
        requirement.defaultImport,
        `* as ${requirement.namespaceImport}`,
      ),
    );
  } else if (requirement.defaultImport || valueNamed.length > 0 || typeNamed.length > 0) {
    const named = [
      ...valueNamed.map(renderNamedImport),
      ...typeNamed.map((entry) => `type ${renderNamedImport(entry)}`),
    ];
    statements.push(
      renderImportStatement(requirement.source, requirement.defaultImport, renderNamedClause(named)),
    );
  }

  if (requirement.typeOnlyDefaultImport || requirement.typeOnlyNamespaceImport) {
    const clause = requirement.typeOnlyNamespaceImport
      ? `${requirement.typeOnlyDefaultImport ? `${requirement.typeOnlyDefaultImport}, ` : ''}* as ${requirement.typeOnlyNamespaceImport}`
      : requirement.typeOnlyDefaultImport ?? '';
    statements.push(`import type ${clause} from '${requirement.source}';`);
  }

  if (requirement.sideEffectOnly && statements.length === 0) {
    statements.push(`import '${requirement.source}';`);
  }

  return statements;
}

function renderImportStatement(source: string, defaultImport: string | undefined, suffix: string): string {
  const clause = [defaultImport, suffix].filter(Boolean).join(', ');
  return `import ${clause} from '${source}';`;
}

function renderNamedClause(entries: readonly string[]): string {
  return entries.length > 0 ? `{ ${entries.join(', ')} }` : '';
}

function renderNamedImport(entry: GeneratedNamedImport): string {
  return entry.local ? `${entry.imported} as ${entry.local}` : entry.imported;
}
