import { createFormDraft, type FormDraftField, parseFormDraft } from '@ankhorage/utility/form';

import type { StudioModuleAdminContribution } from './moduleAdminContracts';

export type StudioModuleAdminDraft = Record<string, string>;

export type StudioModuleAdminDraftResult =
  | { readonly ok: true; readonly config: Record<string, unknown> }
  | { readonly ok: false; readonly message: string };

/***
 * Project a Studio contribution schema through the canonical generic form-draft utility.
 */
export function createStudioModuleAdminDraft(args: {
  readonly contribution: StudioModuleAdminContribution;
  readonly config: unknown;
}): StudioModuleAdminDraft {
  return createFormDraft(toFormDraftFields(args.contribution), args.config);
}

/***
 * Parse a Studio contribution draft through the canonical generic form-draft utility.
 */
export function parseStudioModuleAdminDraft(args: {
  readonly contribution: StudioModuleAdminContribution;
  readonly currentConfig: unknown;
  readonly draft: StudioModuleAdminDraft;
}): StudioModuleAdminDraftResult {
  const result = parseFormDraft({
    fields: toFormDraftFields(args.contribution),
    currentValues: args.currentConfig,
    draft: args.draft,
  });
  return result.ok ? { ok: true, config: result.values } : { ok: false, message: result.message };
}

/*** Translate open Studio control identifiers into the canonical generic form controls. */
function toFormDraftFields(contribution: StudioModuleAdminContribution): readonly FormDraftField[] {
  return contribution.fields.map((field) => ({
    ...field,
    control: field.control === 'text' || field.control === 'string-list' ? field.control : 'json',
  }));
}
