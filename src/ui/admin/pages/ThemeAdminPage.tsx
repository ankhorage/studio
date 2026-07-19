import type { ThemeModeConfig } from '@ankhorage/contracts';
import { Card, Text } from '@ankhorage/zora';
import React from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { useStudio } from '../../../core/StudioContext';
import type { ThemeUpdates } from '../../../index';
import { AdminHeader, AdminScroll, Field, Input } from '../adminPagePrimitives';
import { formatHarmonyLabel, SUPPORTED_COLOR_HARMONIES } from './adminThemeHarmony';

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
  const updateActiveMode = (updates: Partial<ThemeModeConfig>) => {
    updateActiveTheme(mode === 'dark' ? { dark: updates } : { light: updates });
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
                    modeConfig.harmony === harmony ? styles.choiceSelected : null,
                  ]}
                >
                  <Text
                    color={modeConfig.harmony === harmony ? 'primary' : 'neutral'}
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
            No theme is configured in the current Studio manifest.
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
