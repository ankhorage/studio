import { Card, Text } from '@ankhorage/zora';
import React from 'react';

import { AdminHeader, AdminScroll, Field, Input, KeyValue } from '../adminPagePrimitives';
import { ThemeModeEditorSelector } from './ThemeModeEditorSelector';
import { ThemeRecipeCatalog } from './ThemeRecipeCatalog';
import { useActiveThemeAdmin } from './useActiveThemeAdmin';

export function ThemeAdminPage() {
  const { selection, updateTheme } = useActiveThemeAdmin();

  return (
    <AdminScroll>
      <AdminHeader
        title="Theme"
        description="Author the canonical project theme used by the real app and Studio preview."
      />
      {selection ? (
        <>
          <ThemeModeEditorSelector />
          <Card title={selection.theme.name}>
            <Field label="Theme name">
              <Input value={selection.theme.name} onChangeText={(name) => updateTheme({ name })} />
            </Field>
            <KeyValue label="Editing runtime mode" value={selection.mode} />
            <KeyValue
              label="Global token families"
              value="Typography · Spacing · Radii · Shadows"
            />
            <KeyValue label="Mode-specific source" value="Colors · Harmony" />
          </Card>
          <ThemeRecipeCatalog />
          <Card title="Inheritance">
            <Text color="neutral" emphasis="muted">
              Omitted values inherit Surface and ZORA owner defaults. Theme changes do not rewrite
              component instances.
            </Text>
          </Card>
        </>
      ) : (
        <Card title="Theme unavailable">
          <Text color="neutral" emphasis="muted">
            The Studio manifest does not contain a valid active theme.
          </Text>
        </Card>
      )}
    </AdminScroll>
  );
}
