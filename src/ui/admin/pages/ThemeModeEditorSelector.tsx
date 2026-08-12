import { Text, useZoraTheme } from '@ankhorage/zora';
import React from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

const MODES = ['light', 'dark'] as const;

export function ThemeModeEditorSelector() {
  const { mode, setMode, theme } = useZoraTheme();

  return (
    <View style={styles.row}>
      {MODES.map((candidate) => {
        const selected = candidate === mode;
        return (
          <Pressable
            key={candidate}
            accessibilityRole="button"
            accessibilityState={{ selected }}
            onPress={() => setMode(candidate)}
            style={[
              styles.choice,
              {
                backgroundColor: selected ? theme.colors.surface : 'transparent',
                borderColor: selected ? theme.colors.primary : theme.colors.border,
              },
            ]}
          >
            <Text color={selected ? 'primary' : 'neutral'} weight="semiBold">
              {candidate === 'light' ? 'Light' : 'Dark'}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', gap: 8 },
  choice: {
    borderWidth: 1,
    borderRadius: 8,
    minWidth: 84,
    paddingHorizontal: 12,
    paddingVertical: 8,
    alignItems: 'center',
  },
});
