import { useCallback, useEffect, useState } from 'react';

import { isAppCategory, isColorHarmony } from '../contractGuards';
import { API_BASE } from '../core/constants';
import type { TemplateCatalog, TemplateCatalogCategory } from '../templateCatalogContracts';

/***
 * Return whether an unknown value is any non-null JavaScript object, including arrays.
 * @utility @ankhorage/utility/object
 */
function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

/*** Validate one template-catalog category and its embedded template summaries. */
function isCatalogCategory(value: unknown): value is TemplateCatalogCategory {
  return (
    isRecord(value) &&
    isAppCategory(value.id) &&
    typeof value.label === 'string' &&
    typeof value.summary === 'string' &&
    Array.isArray(value.focusAreas) &&
    value.focusAreas.every((entry) => typeof entry === 'string') &&
    typeof value.primaryColor === 'string' &&
    isColorHarmony(value.harmony) &&
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

/*** Validate and normalize an unknown Studio template-catalog response. */
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

/***
 * Fetch and validate the current template catalog from the Studio host.
 * @todo Move concrete template-catalog HTTP access into the templates package-edge adapter.
 */
async function requestTemplateCatalog(): Promise<TemplateCatalog> {
  const response = await fetch(`${API_BASE}/templates`);
  if (!response.ok) {
    throw new Error('Failed to fetch template catalog');
  }
  return parseTemplateCatalog(await response.json());
}

/***
 * Own React loading/error state for the Studio template catalog.
 * @todo Move this hook beside the templates UI/application owner and keep HTTP transport outside the hook.
 */
export function useTemplateCatalog() {
  const [catalog, setCatalog] = useState<TemplateCatalog>({ categories: [] });
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  /*** Reload the template catalog and update hook loading/error state. */
  const loadCatalog = useCallback(async () => {
    try {
      setCatalog(await requestTemplateCatalog());
      setError(null);
    } catch (caught) {
      console.error(caught);
      setError('Could not load templates from the local Studio host.');
    } finally {
      setIsLoading(false);
    }
  }, []);

  /*** Mark the catalog as loading and run a fresh load. */
  const refresh = useCallback(async () => {
    setIsLoading(true);
    await loadCatalog();
  }, [loadCatalog]);

  useEffect(() => {
    let active = true;
    void requestTemplateCatalog()
      .then((nextCatalog) => {
        if (!active) return;
        setCatalog(nextCatalog);
        setError(null);
      })
      .catch((caught: unknown) => {
        console.error(caught);
        if (!active) return;
        setError('Could not load templates from the local Studio host.');
      })
      .finally(() => {
        if (active) setIsLoading(false);
      });

    return () => {
      active = false;
    };
  }, []);

  return {
    catalog,
    isLoading,
    error,
    refresh,
  };
}
