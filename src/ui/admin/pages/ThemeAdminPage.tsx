import type { ThemeModeConfig } from '@ankhorage/contracts';
import { Card, Text, useZoraTheme } from '@ankhorage/zora';
import React from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { useStudio } from '../../../core/StudioContext';
import type { ThemeUpdates } from '../../../index';
import { AdminHeader, AdminScroll, Field, Input } from '../adminPagePrimitives';
import { formatHarmonyLabel, SUPPORTED_COLOR_HARMONIES } from './adminThemeHarmony';
import { createThemeModeUpdates, resolveActiveThemeModeSelection } from './adminThemeModel';

export function ThemeAdminPage() {
  const studio = useStudio();
  const { mode: surfaceMode } = useZoraTheme();
  const selection = studio.manifest
    ? resolveActiveThemeModeSelection({
        themes: studio.manifest.themes,
        activeThemeId: studio.manifest.activeThemeId,
        surfaceMode,
      })
    : null;
  const updateActiveTheme = (updates: ThemeUpdates) => {
    if (!selection) return;
    studio.updateTheme(selection.theme.id, updates);
  };
  const updateActiveMode = (updates: Partial<ThemeModeConfig>) => {
    if (!selection) return;
    updateActiveTheme(createThemeModeUpdates(selection.mode, updates));
  };

  return (
    <AdminScroll>
      <AdminHeader
        title="Theme"
        description="Edit the canonical active theme for the currently active theme mode."
      />
      {selection ? (
        <Card title={selection.theme.name}>
          <Field label="Theme name">
            <Input
              value={selection.theme.name}
              onChangeText={(name) => updateActiveTheme({ name })}
            />
          </Field>
          <Field label="Primary color">
            <Input
              value={selection.modeConfig.primaryColor}
              autoCapitalize="none"
              onChangeText={(primaryColor) => updateActiveMode({ primaryColor })}
            />
          </Field>
          <Field label="Harmony">
            <View style={styles.choiceRow}>
              {SUPPORTED_COLOR_HARMONIES.map((harmony) => (
                <Pressable
                  key={harmony}
                  onPress={() => updateActiveMode({ harmony })}
                  style={[
                    styles.choice,
                    selection.modeConfig.harmony === harmony ? styles.choiceSelected : null,
                  ]}
                >
                  <Text
                    color={selection.modeConfig.harmony === harmony ? 'primary' : 'neutral'}
                    variant="bodySmall"
                    weight="semiBold"
                  >
                    {formatHarmonyLabel(harmony)}
                  </Text>
                </Pressable>
              ))}
            </View>
          </Field>
        </Card>
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

const styles = StyleSheet.create({
  choiceRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  choice: {
    borderWidth: 1,
    borderRadius: 999,
    borderColor: 'transparent',
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  choiceSelected: {
    borderColor: '#4f46e5',
  },
});
