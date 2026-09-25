/*** Canonical Studio project identity syntax and workspace-reserved ids. */
export const STUDIO_PROJECT_ID_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/u;
export const STUDIO_RESERVED_PROJECT_IDS: ReadonlySet<string> = new Set(['studio']);
