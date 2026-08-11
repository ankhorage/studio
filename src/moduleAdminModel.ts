import type { StudioModuleAdminContribution } from './moduleAdminContracts';

export type StudioModuleAdminDraft = Record<string, string>;

export type StudioModuleAdminDraftResult =
  | { readonly ok: true; readonly config: Record<string, unknown> }
  | { readonly ok: false; readonly message: string };

export function createStudioModuleAdminDraft(args: {
  readonly contribution: StudioModuleAdminContribution;
  readonly config: unknown;
}): StudioModuleAdminDraft {
  const config = isRecord(args.config) ? args.config : {};
  return Object.fromEntries(
    args.contribution.fields.map((field) => {
      const value = config[field.key];
      if (field.control === 'string-list') {
        return [field.key, isStringArray(value) ? value.join(', ') : ''];
      }
      if (field.control !== 'text') {
        return [field.key, value === undefined ? '' : JSON.stringify(value, null, 2)];
      }
      return [field.key, typeof value === 'string' ? value : ''];
    }),
  );
}

export function parseStudioModuleAdminDraft(args: {
  readonly contribution: StudioModuleAdminContribution;
  readonly currentConfig: unknown;
  readonly draft: StudioModuleAdminDraft;
}): StudioModuleAdminDraftResult {
  const config: Record<string, unknown> = isRecord(args.currentConfig)
    ? { ...args.currentConfig }
    : {};

  for (const field of args.contribution.fields) {
    const raw = args.draft[field.key]?.trim() ?? '';
    if (field.control === 'text') {
      if (field.required && !raw) return requiredField(field.label);
      config[field.key] = raw;
      continue;
    }
    if (field.control === 'string-list') {
      const values = raw
        .split(',')
        .map((value) => value.trim())
        .filter(Boolean);
      if (field.required && values.length === 0) return requiredField(field.label);
      config[field.key] = values;
      continue;
    }

    if (field.required && !raw) return requiredField(field.label);

    let parsed: unknown;
    try {
      parsed = raw ? JSON.parse(raw) : null;
    } catch {
      return { ok: false, message: `${field.label} must be valid JSON.` };
    }
    config[field.key] = parsed;
  }

  return { ok: true, config };
}

function requiredField(label: string): StudioModuleAdminDraftResult {
  return { ok: false, message: `${label} is required.` };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isStringArray(value: unknown): value is string[] {
  return Array.isArray(value) && value.every((entry) => typeof entry === 'string');
}
