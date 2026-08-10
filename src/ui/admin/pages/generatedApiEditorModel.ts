import type {
  DataContractValue,
  DataSourceDiagnostic,
  DbFieldDefinition,
  DbFieldType,
  GeneratedApiCrudOperation,
  GeneratedApiDefinition,
  GeneratedApiResourceDefinition,
  GeneratedApiSeedRecord,
  GeneratedRestApiDataSourceConfig,
} from '@ankhorage/contracts';
import { GENERATED_API_CRUD_OPERATIONS } from '@ankhorage/contracts';
import {
  createGeneratedApiDataSource,
  validateGeneratedApiDefinition,
} from '@ankhorage/data-sources';

export interface GeneratedApiFieldDraft {
  readonly name: string;
  readonly type: DbFieldType;
  readonly required: boolean;
  readonly unique: boolean;
  readonly defaultValueText: string;
}

export interface GeneratedApiResourceDraft {
  readonly id: string;
  readonly name: string;
  readonly description: string;
  readonly path: string;
  readonly collectionName: string;
  readonly schema: string;
  readonly primaryKey: string;
  readonly fields: readonly GeneratedApiFieldDraft[];
  readonly operations: readonly GeneratedApiCrudOperation[];
  readonly seedText: string;
}

export interface GeneratedApiEditorDraft {
  readonly originalId?: string;
  readonly id: string;
  readonly name: string;
  readonly description: string;
  readonly basePath: string;
  readonly databaseAdapterId: string;
  readonly resources: readonly GeneratedApiResourceDraft[];
}

export interface GeneratedApiEditorResolution {
  readonly definition?: GeneratedApiDefinition;
  readonly dataSource?: GeneratedRestApiDataSourceConfig;
  readonly diagnostics: readonly DataSourceDiagnostic[];
}

export function createGeneratedApiEditorDraft(
  definition?: GeneratedApiDefinition,
): GeneratedApiEditorDraft {
  if (!definition) {
    return {
      id: '',
      name: '',
      description: '',
      basePath: '/api',
      databaseAdapterId: 'primary-db',
      resources: [createGeneratedApiResourceDraft()],
    };
  }

  return {
    originalId: definition.id,
    id: definition.id,
    name: definition.name ?? '',
    description: definition.description ?? '',
    basePath: definition.basePath,
    databaseAdapterId: definition.database.id,
    resources: definition.resources.map(toResourceDraft),
  };
}

export function createGeneratedApiResourceDraft(index = 0): GeneratedApiResourceDraft {
  const suffix = index === 0 ? 'items' : `items-${index + 1}`;
  return {
    id: suffix,
    name: '',
    description: '',
    path: `/${suffix}`,
    collectionName: suffix.replaceAll('-', '_'),
    schema: 'public',
    primaryKey: 'id',
    fields: [
      {
        name: 'id',
        type: 'uuid',
        required: true,
        unique: true,
        defaultValueText: '',
      },
    ],
    operations: [...GENERATED_API_CRUD_OPERATIONS],
    seedText: '[]',
  };
}

export function createGeneratedApiFieldDraft(): GeneratedApiFieldDraft {
  return {
    name: '',
    type: 'text',
    required: false,
    unique: false,
    defaultValueText: '',
  };
}

export function resolveGeneratedApiEditorDraft(
  draft: GeneratedApiEditorDraft,
): GeneratedApiEditorResolution {
  const diagnostics: DataSourceDiagnostic[] = [];
  const resources = draft.resources.map((resource, resourceIndex) =>
    resolveResourceDraft(draft.id, resource, resourceIndex, diagnostics),
  );

  if (!draft.id.trim()) {
    diagnostics.push(diagnostic(draft.id, 'Generated API ID is required.', 'id'));
  }
  if (!draft.databaseAdapterId.trim()) {
    diagnostics.push(diagnostic(draft.id, 'A database adapter ID is required.', 'database.id'));
  }
  const definition: GeneratedApiDefinition = {
    id: draft.id.trim(),
    protocol: 'rest',
    name: clean(draft.name),
    description: clean(draft.description),
    basePath: draft.basePath.trim(),
    database: { id: draft.databaseAdapterId.trim(), kind: 'database' },
    resources,
  };
  if (diagnostics.some((entry) => entry.severity === 'error')) {
    return {
      definition,
      diagnostics: [...diagnostics, ...validateGeneratedApiDefinition(definition)],
    };
  }

  const projection = createGeneratedApiDataSource(definition);
  if (!projection.ok) {
    return { definition, diagnostics: [...diagnostics, ...projection.diagnostics] };
  }

  return {
    definition,
    dataSource: projection.data,
    diagnostics: [...diagnostics, ...(projection.diagnostics ?? [])],
  };
}

function resolveResourceDraft(
  apiId: string,
  draft: GeneratedApiResourceDraft,
  resourceIndex: number,
  diagnostics: DataSourceDiagnostic[],
): GeneratedApiResourceDefinition {
  const fields = draft.fields.map((field, fieldIndex) =>
    resolveFieldDraft(apiId, field, resourceIndex, fieldIndex, diagnostics),
  );
  const seed = parseSeed(apiId, draft.seedText, resourceIndex, diagnostics);
  const primaryKey = clean(draft.primaryKey);

  return {
    id: draft.id.trim(),
    name: clean(draft.name),
    description: clean(draft.description),
    path: draft.path.trim(),
    collection: {
      name: draft.collectionName.trim(),
      schema: clean(draft.schema),
      fields,
      primaryKey,
    },
    operations: [...draft.operations],
    seed,
  };
}

function resolveFieldDraft(
  apiId: string,
  draft: GeneratedApiFieldDraft,
  resourceIndex: number,
  fieldIndex: number,
  diagnostics: DataSourceDiagnostic[],
): DbFieldDefinition {
  const name = draft.name.trim();
  const parsedDefault = parseDefaultValue(draft);
  if (!parsedDefault.ok) {
    diagnostics.push(
      diagnostic(
        apiId,
        parsedDefault.message,
        `resources.${resourceIndex}.collection.fields.${fieldIndex}.defaultValue`,
      ),
    );
  }

  return {
    name,
    type: draft.type,
    required: draft.required || undefined,
    unique: draft.unique || undefined,
    defaultValue: parsedDefault.ok ? parsedDefault.value : undefined,
  };
}

function parseSeed(
  apiId: string,
  seedText: string,
  resourceIndex: number,
  diagnostics: DataSourceDiagnostic[],
): readonly GeneratedApiSeedRecord[] | undefined {
  const normalized = seedText.trim();
  if (!normalized || normalized === '[]') return undefined;

  let value: unknown;
  try {
    value = JSON.parse(normalized) as unknown;
  } catch {
    diagnostics.push(
      diagnostic(apiId, 'Seed records must be valid JSON.', `resources.${resourceIndex}.seed`),
    );
    return undefined;
  }
  if (!Array.isArray(value) || !value.every(isSeedRecord)) {
    diagnostics.push(
      diagnostic(
        apiId,
        'Seed records must be a JSON array of serializable objects.',
        `resources.${resourceIndex}.seed`,
      ),
    );
    return undefined;
  }
  return value;
}

function isSeedRecord(value: unknown): value is GeneratedApiSeedRecord {
  return isRecord(value) && Object.values(value).every(isDataContractValue);
}

function isDataContractValue(value: unknown): value is DataContractValue {
  if (value === null || typeof value === 'string' || typeof value === 'boolean') return true;
  if (typeof value === 'number') return Number.isFinite(value);
  if (Array.isArray(value)) return value.every(isDataContractValue);
  return isRecord(value) && Object.values(value).every(isDataContractValue);
}

function parseDefaultValue(
  draft: GeneratedApiFieldDraft,
):
  | { readonly ok: true; readonly value: string | number | boolean | null | undefined }
  | { readonly ok: false; readonly message: string } {
  const value = draft.defaultValueText.trim();
  if (!value) return { ok: true, value: undefined };
  if (draft.type === 'text' || draft.type === 'uuid' || draft.type === 'datetime') {
    return { ok: true, value };
  }
  if (draft.type === 'number') {
    const parsed = Number(value);
    return Number.isFinite(parsed)
      ? { ok: true, value: parsed }
      : { ok: false, message: 'Number defaults must be finite numbers.' };
  }
  if (draft.type === 'boolean') {
    if (value === 'true') return { ok: true, value: true };
    if (value === 'false') return { ok: true, value: false };
    return { ok: false, message: 'Boolean defaults must be true or false.' };
  }

  try {
    const parsed = JSON.parse(value) as unknown;
    return parsed === null || ['boolean', 'number', 'string'].includes(typeof parsed)
      ? { ok: true, value: parsed as string | number | boolean | null }
      : { ok: false, message: 'JSON defaults must be a scalar JSON value.' };
  } catch {
    return { ok: false, message: 'JSON defaults must be valid JSON scalars.' };
  }
}

function toResourceDraft(resource: GeneratedApiResourceDefinition): GeneratedApiResourceDraft {
  return {
    id: resource.id,
    name: resource.name ?? '',
    description: resource.description ?? '',
    path: resource.path,
    collectionName: resource.collection.name,
    schema: resource.collection.schema ?? '',
    primaryKey: resource.collection.primaryKey ?? '',
    fields: resource.collection.fields.map((field) => ({
      name: field.name,
      type: field.type,
      required: field.required ?? false,
      unique: field.unique ?? false,
      defaultValueText: formatDefaultValue(field.defaultValue),
    })),
    operations: [...resource.operations],
    seedText: JSON.stringify(resource.seed ?? [], null, 2),
  };
}

function formatDefaultValue(value: string | number | boolean | null | undefined): string {
  if (value === undefined) return '';
  if (value === null) return 'null';
  return String(value);
}

function clean(value: string): string | undefined {
  const normalized = value.trim();
  return normalized || undefined;
}

function diagnostic(apiId: string, message: string, path: string): DataSourceDiagnostic {
  return {
    code: 'invalid-config',
    dataSourceId: apiId.trim() || undefined,
    message,
    path,
    severity: 'error',
  };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
