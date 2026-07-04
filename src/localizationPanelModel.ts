import type { UiNode } from '@ankhorage/contracts';

export interface TranslatableFieldRef {
  screenId: string;
  nodeId: string;
  componentName: string;
  keyProp: string;
  defaultTextProp: string;
  currentKey: string;
  defaultText: string;
  path: string;
}

export interface TranslatableComponentMetaField {
  keyProp: string;
  defaultTextProp: string;
}

export interface TranslatableComponentMeta {
  i18n?: {
    fields?: readonly TranslatableComponentMetaField[];
  };
}

export type TranslatableComponentMetaRegistry = Record<string, TranslatableComponentMeta | undefined>;

export function collectTranslatableFields(args: {
  root: UiNode;
  componentMeta: TranslatableComponentMetaRegistry;
  screenId: string;
}): TranslatableFieldRef[] {
  const { root, componentMeta, screenId } = args;
  const refs: TranslatableFieldRef[] = [];

  function traverse(node: UiNode, path: string): void {
    const meta = componentMeta[node.type] ?? null;
    const fields = meta?.i18n?.fields ?? [];

    for (const field of fields) {
      const currentKey = (node.props?.[field.keyProp] as string | undefined) ?? '';
      const defaultText = (node.props?.[field.defaultTextProp] as string | undefined) ?? '';

      refs.push({
        screenId,
        nodeId: node.id,
        componentName: node.type,
        keyProp: field.keyProp,
        defaultTextProp: field.defaultTextProp,
        currentKey,
        defaultText,
        path: `${path} > ${node.alias ?? node.type}`,
      });
    }

    node.children?.forEach((child) => {
      traverse(child, `${path} > ${node.alias ?? node.type}`);
    });
  }

  traverse(root, screenId);
  return refs;
}

export function createLocalizationKeyFromText(text: string): string {
  const normalized = text.trim().toLowerCase();
  let key = '';
  let previousWasSeparator = false;

  for (const char of normalized) {
    if ((char >= 'a' && char <= 'z') || (char >= '0' && char <= '9') || char === '-') {
      key += char;
      previousWasSeparator = false;
      continue;
    }

    if (char === ' ' || char === '_' || char === '\t' || char === '\n') {
      if (!previousWasSeparator && key.length > 0) {
        key += '_';
        previousWasSeparator = true;
      }
    }
  }

  return key.endsWith('_') ? key.slice(0, -1) : key;
}

export function filterTranslatableFields(args: {
  fields: readonly TranslatableFieldRef[];
  searchQuery: string;
  showOnlyMissing: boolean;
  activeLocale: string;
  dictionaries: Record<string, Record<string, string>>;
}): TranslatableFieldRef[] {
  const { fields, searchQuery, showOnlyMissing, activeLocale, dictionaries } = args;
  const normalizedQuery = searchQuery.trim().toLowerCase();

  return fields.filter((field) => {
    const matchesSearch =
      normalizedQuery.length === 0 ||
      field.nodeId.toLowerCase().includes(normalizedQuery) ||
      field.currentKey.toLowerCase().includes(normalizedQuery) ||
      field.defaultText.toLowerCase().includes(normalizedQuery) ||
      field.path.toLowerCase().includes(normalizedQuery);

    if (!matchesSearch) return false;
    if (showOnlyMissing) {
      return !field.currentKey || !dictionaries[activeLocale]?.[field.currentKey];
    }
    return true;
  });
}

export function createLocaleAddConfig(args: {
  currentLocales: readonly string[];
  localeInput: string;
}): { locale: string; nextLocales: string[] } | null {
  const locale = args.localeInput.trim().toLowerCase();
  if (!locale || args.currentLocales.includes(locale)) {
    return null;
  }

  return { locale, nextLocales: [...args.currentLocales, locale] };
}

export function createLocaleRemoveConfig(args: {
  locales: readonly string[];
  defaultLocale: string;
  localeToRemove: string;
}): { nextLocales: string[]; nextDefaultLocale: string } | null {
  if (args.locales.length <= 1) {
    return null;
  }

  const nextLocales = args.locales.filter((locale) => locale !== args.localeToRemove);
  const nextDefaultLocale =
    args.defaultLocale === args.localeToRemove ? (nextLocales[0] ?? args.defaultLocale) : args.defaultLocale;

  return { nextLocales, nextDefaultLocale };
}
