import { Card, useZoraTheme } from '@ankhorage/zora';
import React from 'react';

import { AuthoringEditor } from '../../../features/authoring-engine/adapters/inbound/AuthoringEditor';
import { applyThemeAuthoringMutation } from '../../../features/authoring-engine/adapters/outbound/applyThemeAuthoringMutation';
import { deriveThemeAuthoringModel } from '../../../features/authoring-engine/adapters/outbound/deriveThemeAuthoringModel';
import type { AuthoringMutation } from '../../../types/authoring-engine';
import { AdminHeader, AdminScroll } from '../adminPagePrimitives';
import { useActiveThemeAdmin } from './useActiveThemeAdmin';

/*** Render one numeric Theme token family from owner structure with resolved ZORA values as inheritance. */
export function ThemeNumericTokensAdminPage(props: { readonly family: NumericThemeTokenFamily }) {
  const { theme: resolvedTheme } = useZoraTheme();
  const { selection, updateTheme } = useActiveThemeAdmin();
  const copy = resolveNumericThemeTokenCopy(props.family);

  if (!selection) return <ThemeUnavailable />;

  const resolvedValue =
    props.family === 'spacing'
      ? { tokens: { spacing: resolvedTheme.spacing } }
      : props.family === 'radii'
        ? { tokens: { radii: resolvedTheme.radii } }
        : { tokens: { shadows: resolvedTheme.shadows } };
  const model = deriveThemeAuthoringModel({
    theme: selection.theme,
    path: ['tokens', props.family],
    resolvedValue,
  });

  /*** Apply one owner-derived token mutation through the canonical Theme boundary. */
  const updateAuthoredTheme = (mutation: AuthoringMutation) => {
    const result = applyThemeAuthoringMutation(selection.theme, mutation);
    if (result.ok) updateTheme(result.value);
  };

  return (
    <AdminScroll>
      <AdminHeader title={copy.title} description={copy.description} />
      <Card title={`${selection.theme.name} · ${copy.title}`}>
        <AuthoringEditor model={model} onMutation={updateAuthoredTheme} />
      </Card>
    </AdminScroll>
  );
}

type NumericThemeTokenFamily = 'spacing' | 'radii' | 'shadows';

interface NumericThemeTokenCopy {
  readonly title: string;
  readonly description: string;
}

/*** Resolve route-specific numeric Theme copy without dynamic object indexing. */
function resolveNumericThemeTokenCopy(family: NumericThemeTokenFamily): NumericThemeTokenCopy {
  switch (family) {
    case 'spacing':
      return { title: 'Spacing', description: 'Shared spacing tokens used by Theme recipes.' };
    case 'radii':
      return { title: 'Radii', description: 'Shared corner-radius tokens used by Theme recipes.' };
    case 'shadows':
      return {
        title: 'Shadows',
        description: 'Shared shadow-strength tokens used by Theme recipes.',
      };
  }
}

/*** Render the numeric-token page fallback when no active theme is available. */
function ThemeUnavailable() {
  return (
    <AdminScroll>
      <AdminHeader
        title="Theme unavailable"
        description="No canonical active theme is available."
      />
    </AdminScroll>
  );
}
