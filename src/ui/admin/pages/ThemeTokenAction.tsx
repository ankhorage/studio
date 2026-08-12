import { Text, useZoraTheme } from '@ankhorage/zora';
import React from 'react';
import { Pressable, StyleSheet } from 'react-native';

export function ThemeTokenAction(props: { readonly label: string; readonly onPress: () => void }) {
  const { theme } = useZoraTheme();
  return (
    <Pressable
      accessibilityRole="button"
      onPress={props.onPress}
      style={[styles.action, { borderColor: theme.colors.border }]}
    >
      <Text color="primary" weight="semiBold">
        {props.label}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  action: {
    minHeight: 42,
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 9,
    justifyContent: 'center',
    alignSelf: 'flex-start',
  },
});
