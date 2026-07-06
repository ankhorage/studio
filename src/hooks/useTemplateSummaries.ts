import { useCallback, useEffect, useState } from 'react';

import { API_BASE } from '../core/constants';
import type { TemplateSummary } from '../modules/dashboard/types';

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function isTemplateSummary(value: unknown): value is TemplateSummary {
  return (
    isRecord(value) &&
    typeof value.id === 'string' &&
    typeof value.category === 'string' &&
    typeof value.templateId === 'string' &&
    typeof value.name === 'string' &&
    typeof value.description === 'string' &&
    typeof value.version === 'string'
  );
}

function parseTemplateSummaries(value: unknown): TemplateSummary[] {
  if (!Array.isArray(value) || !value.every(isTemplateSummary)) {
    throw new Error('Templates response was not a valid template summary list');
  }

  return value;
}

export function useTemplateSummaries() {
  const [templates, setTemplates] = useState<TemplateSummary[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchTemplates = useCallback(async () => {
    try {
      setIsLoading(true);
      const response = await fetch(`${API_BASE}/templates`);
      if (!response.ok) {
        throw new Error('Failed to fetch templates');
      }

      const data = parseTemplateSummaries(await response.json());
      setTemplates(data);
      setError(null);
    } catch (caught) {
      console.error(caught);
      setError('Could not load templates from the CLI bridge.');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    void fetchTemplates();
  }, [fetchTemplates]);

  return {
    templates,
    isLoading,
    error,
    refresh: fetchTemplates,
  };
}
