import type { ThemeModeConfig } from '@ankhorage/contracts';
import { Card, Text } from '@ankhorage/zora';
import React from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { AdminHeader, AdminScroll, Field, Input } from '../adminPagePrimitives';
import { formatHarmonyLabel, SUPPORTED_COLOR_HARMONIES } from './adminThemeHarmony';
import { createThemeModeUpdates } from './adminThemeModel';
import { ThemeModeEditorSelector } from './ThemeModeEditorSelector';
import { useActiveThemeAdmin } from './useActiveThemeAdmin';

/*** Render primary-color and harmony authoring for the active light/dark runtime theme mode. */
export function ThemeColorsAdminPage() {
  const { selection, updateTheme } = useActiveThemeAdmin();
  if (!selection) return <Unavailable />;

  /*** Wrap partial mode config changes in the active light/dark branch before updating the theme. */
  const updateMode = (updates: Partial<ThemeModeConfig>) => {
    updateTheme(createThemeModeUpdates(selection.mode, updates));
  };

  return (
    <AdminScroll>
      <AdminHeader
        title="Colors"
        description="Edit the canonical color source for the runtime mode currently being previewed."
      />
      <ThemeModeEditorSelector />
      <Card title={`${selection.theme.name} · ${selection.mode === 'light' ? 'Light' : 'Dark'}`}>
        <Field label="Primary color">
          <Input
            value={selection.modeConfig.primaryColor}
            autoCapitalize="none"
            onChangeText={(primaryColor) => updateMode({ primaryColor })}
          />
        </Field>
        <Field label="Harmony">
          <View style={styles.choiceRow}>
            {SUPPORTED_COLOR_HARMONIES.map((harmony) => (
              <HarmonyChoice
                key={harmony}
                harmony={harmony}
                selected={selection.modeConfig.harmony === harmony}
                onPress={() => updateMode({ harmony })}
              />
            ))}
          </View>
        </Field>
      </Card>
    </AdminScroll>
  );
}

/*** Render one selectable color-harmony option. */
function HarmonyChoice(props: {
  readonly harmony: ThemeModeConfig['harmony'];
  readonly selected: boolean;
  readonly onPress: () => void;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ selected: props.selected }}
      onPress={props.onPress}
      style={[styles.choice, props.selected ? styles.choiceSelected : null]}
    >
      <Text color={props.selected ? 'primary' : 'neutral'} variant="bodySmall" weight="semiBold">
        {formatHarmonyLabel(props.harmony)}
      </Text>
    </Pressable>
  );
}

/*** Render the theme-colors fallback when no canonical active theme is available. */
function Unavailable() {
  return (
    <AdminScroll>
      <AdminHeader
        title="Theme unavailable"
        description="No canonical active theme is available."
      />
    </AdminScroll>
  );
}

const styles = StyleSheet.create({
  choiceRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  choice: {
    borderWidth: 1,
    borderRadius: 999,
    borderColor: 'transparent',
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  choiceSelected: { borderColor: '#4f46e5' },
});
