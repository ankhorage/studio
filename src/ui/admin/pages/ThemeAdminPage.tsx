import type { ThemeModeConfig } from '@ankhorage/contracts';
import { Card, Text } from '@ankhorage/zora';
import React from 'react';

import { useStudio } from '../../../core/StudioContext';
import type { ThemeUpdates } from '../../../index';
import { AdminHeader, AdminScroll, Field, Input } from '../adminPagePrimitives';

export function ThemeAdminPage() {
  const studio = useStudio();
  const activeTheme =
    studio.manifest?.themes.find((theme) => theme.id === studio.manifest?.activeThemeId) ??
    studio.manifest?.themes[0] ??
    null;
  const mode = studio.manifest?.activeThemeMode ?? studio.studioMode;
  const modeConfig = activeTheme?.[mode] ?? null;
  const updateActiveTheme = (updates: ThemeUpdates) => {
    if (!activeTheme) return;
    studio.updateTheme(activeTheme.id, updates);
  };

  return (
    <AdminScroll>
      <AdminHeader
        title="Theme"
        description="Edit the canonical active theme for the currently active theme mode."
      />
      {activeTheme && modeConfig ? (
        <Card title={activeTheme.name}>
          <Field label="Theme name">
            <Input value={activeTheme.name} onChangeText={(name) => updateActiveTheme({ name })} />
          </Field>
          <Field label="Primary color">
            <Input
              value={modeConfig.primaryColor}
              autoCapitalize="none"
              onChangeText={(primaryColor) =>
                updateActiveTheme({ [mode]: { primaryColor } } as ThemeUpdates)
              }
            />
          </Field>
          <Field label="Harmony">
            <Input
              value={modeConfig.harmony}
              autoCapitalize="none"
              onChangeText={(harmony) =>
                updateActiveTheme({
                  [mode]: { harmony: harmony as ThemeModeConfig['harmony'] },
                } as ThemeUpdates)
              }
            />
          </Field>
        </Card>
      ) : (
        <Card title="Theme unavailable">
          <Text color="neutral" emphasis="muted">
            No theme is configured in the current Studio manifest.
          </Text>
        </Card>
      )}
    </AdminScroll>
  );
}
