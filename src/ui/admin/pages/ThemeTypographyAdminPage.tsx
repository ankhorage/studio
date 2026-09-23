import { Card, Text, useZoraTheme } from '@ankhorage/zora';
import React from 'react';

import { AuthoringEditor } from '../../../features/authoring-engine/adapters/inbound/AuthoringEditor';
import { applyThemeAuthoringMutation } from '../../../features/authoring-engine/adapters/outbound/applyThemeAuthoringMutation';
import { deriveThemeAuthoringModel } from '../../../features/authoring-engine/adapters/outbound/deriveThemeAuthoringModel';
import type { AuthoringMutation } from '../../../types/authoring-engine';
import { AdminHeader, AdminScroll } from '../adminPagePrimitives';
import { useActiveThemeAdmin } from './useActiveThemeAdmin';

/*** Render global typography overrides from the owner structure with resolved ZORA typography as inheritance. */
export function ThemeTypographyAdminPage() {
  const { theme: resolvedTheme } = useZoraTheme();
  const { selection, updateTheme } = useActiveThemeAdmin();

  if (!selection) {
    return (
      <AdminScroll>
        <AdminHeader
          title="Typography"
          description="Edit theme-global type scales and semantic weights shared across runtime modes."
        />
        <Card title="Theme unavailable">
          <Text color="neutral" emphasis="muted">
            The Studio manifest does not contain a valid active theme.
          </Text>
        </Card>
      </AdminScroll>
    );
  }

  const model = deriveThemeAuthoringModel({
    theme: selection.theme,
    path: ['tokens', 'typography'],
    resolvedValue: { tokens: { typography: resolvedTheme.typography } },
  });

  /*** Apply one owner-derived typography mutation through the canonical Theme boundary. */
  const updateAuthoredTheme = (mutation: AuthoringMutation) => {
    const result = applyThemeAuthoringMutation(selection.theme, mutation);
    if (result.ok) updateTheme(result.value);
  };

  return (
    <AdminScroll>
      <AdminHeader
        title="Typography"
        description="Edit theme-global type scales and semantic weights shared across runtime modes."
      />
      <Card title={`${selection.theme.name} · Typography`}>
        <AuthoringEditor model={model} onMutation={updateAuthoredTheme} />
      </Card>
    </AdminScroll>
  );
}
