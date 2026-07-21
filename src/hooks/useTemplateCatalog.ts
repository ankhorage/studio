import type { AppCategory, ThemeConfig } from '@ankhorage/contracts';
import { APP_CATEGORIES } from '@ankhorage/contracts';
import { useCallback, useEffect, useState } from 'react';

import { API_BASE } from '../core/constants';
import type { TemplateCatalog, TemplateCatalogCategory } from '../modules/dashboard/types';

const APP_CATEGORY_SET = new Set<string>(APP_CATEGORIES);

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function isAppCategory(value: unknown): value is AppCategory {
  return typeof value === 'string' && APP_CATEGORY_SET.has(value);
}

function isHarmony(value: unknown): value is ThemeConfig['light']['harmony'] {
  return typeof value === 'string';
}

function isCatalogCategory(value: unknown): value is TemplateCatalogCategory {
  return (
    isRecord(value) &&
    isAppCategory(value.id) &&
    typeof value.label === 'string' &&
    typeof value.summary === 'string' &&
    Array.isArray(value.focusAreas) &&
    value.focusAreas.every((entry) => typeof entry === 'string') &&
    typeof value.primaryColor === 'string' &&
    isHarmony(value.harmony) &&
    typeof value.templateCount === 'number' &&
    Array.isArray(value.templates) &&
    value.templates.every(
      (template) =>
        isRecord(template) &&
        typeof template.id === 'string' &&
        typeof template.templateId === 'string' &&
        typeof template.name === 'string' &&
        typeof template.description === 'string',
    )
  );
}

function parseTemplateCatalog(value: unknown): TemplateCatalog {
  if (
    !isRecord(value) ||
    !Array.isArray(value.categories) ||
    !value.categories.every(isCatalogCategory)
  ) {
    throw new Error('Template catalog response was invalid');
  }

  return { categories: value.categories };
}

export function useTemplateCatalog() {
  const [catalog, setCatalog] = useState<TemplateCatalog>({ categories: [] });
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchCatalog = useCallback(async () => {
    try {
      setIsLoading(true);
      const response = await fetch(`${API_BASE}/templates`);
      if (!response.ok) {
        throw new Error('Failed to fetch template catalog');
      }

      setCatalog(parseTemplateCatalog(await response.json()));
      setError(null);
    } catch (caught) {
      console.error(caught);
      setError('Could not load templates from the local Studio host.');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    void fetchCatalog();
  }, [fetchCatalog]);

  return {
    catalog,
    isLoading,
    error,
    refresh: fetchCatalog,
  };
}
