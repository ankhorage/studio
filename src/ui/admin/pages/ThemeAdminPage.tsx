import { Card, Text } from '@ankhorage/zora';
import React from 'react';

import { AuthoringEditor } from '../../../features/authoring-engine/adapters/inbound/AuthoringEditor';
import { applyThemeAuthoringMutation } from '../../../features/authoring-engine/adapters/outbound/applyThemeAuthoringMutation';
import { deriveThemeAuthoringModel } from '../../../features/authoring-engine/adapters/outbound/deriveThemeAuthoringModel';
import type { AuthoringMutation } from '../../../types/authoring-engine';
import { AdminHeader, AdminScroll, KeyValue } from '../adminPagePrimitives';
import { ThemeModeEditorSelector } from './ThemeModeEditorSelector';
import { ThemeRecipeCatalog } from './ThemeRecipeCatalog';
import { useActiveThemeAdmin } from './useActiveThemeAdmin';

/*** Render active-theme metadata, global/mode ownership guidance, and the catalog of ZORA theme recipes. */
export function ThemeAdminPage() {
  const { selection, updateTheme } = useActiveThemeAdmin();

  if (!selection) {
    return (
      <AdminScroll>
        <AdminHeader
          title="Theme"
          description="Author the canonical project theme used by the real app and Studio preview."
        />
        <Card title="Theme unavailable">
          <Text color="neutral" emphasis="muted">
            The Studio manifest does not contain a valid active theme.
          </Text>
        </Card>
      </AdminScroll>
    );
  }

  const model = deriveThemeAuthoringModel({ theme: selection.theme, path: ['name'] });

  /*** Apply one owner-derived Theme field mutation through the canonical manifest Theme boundary. */
  const updateAuthoredTheme = (mutation: AuthoringMutation) => {
    const result = applyThemeAuthoringMutation(selection.theme, mutation);
    if (result.ok) updateTheme(result.value);
  };

  return (
    <AdminScroll>
      <AdminHeader
        title="Theme"
        description="Author the canonical project theme used by the real app and Studio preview."
      />
      <ThemeModeEditorSelector />
      <Card title={selection.theme.name}>
        <AuthoringEditor model={model} onMutation={updateAuthoredTheme} />
        <KeyValue label="Editing runtime mode" value={selection.mode} />
        <KeyValue label="Global token families" value="Typography · Spacing · Radii · Shadows" />
        <KeyValue label="Mode-specific source" value="Colors · Harmony" />
      </Card>
      <ThemeRecipeCatalog />
      <Card title="Inheritance">
        <Text color="neutral" emphasis="muted">
          Omitted values inherit Surface and ZORA owner defaults. Theme changes do not rewrite
          component instances.
        </Text>
      </Card>
    </AdminScroll>
  );
}
