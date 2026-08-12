import { Card, useZoraTheme } from '@ankhorage/zora';
import React, { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { Field, Input } from '../adminPagePrimitives';
import { ThemeTokenAction } from './ThemeTokenAction';
import { updateTypographySize } from './themeTokenAuthoringModel';
import { useActiveThemeAdmin } from './useActiveThemeAdmin';

export function ThemeTypographySizeEditor() {
  const { theme: resolvedTheme } = useZoraTheme();
  const { selection, updateTheme } = useActiveThemeAdmin();
  const [newKey, setNewKey] = useState('');
  const [newValue, setNewValue] = useState('');
  if (!selection) return null;

  const updateSize = (key: string, value: number | undefined) => {
    updateTheme({
      tokens: updateTypographySize({ tokens: selection.theme.tokens, key, value }),
    });
  };

  const addSize = () => {
    const key = newKey.trim();
    const value = parseNonNegativeNumber(newValue);
    if (!key || value === null) return;
    updateSize(key, value);
    setNewKey('');
    setNewValue('');
  };

  return (
    <Card title="Type sizes">
      <View style={styles.list}>
        {Object.entries(resolvedTheme.typography.sizes).map(([key, value]) => (
          <SizeRow
            key={key}
            tokenKey={key}
            value={value}
            authored={selection.theme.tokens?.typography?.sizes?.[key] !== undefined}
            onChange={(next) => updateSize(key, next)}
          />
        ))}
      </View>
      <View style={styles.addRow}>
        <View style={styles.grow}>
          <Field label="New size token">
            <Input value={newKey} autoCapitalize="none" onChangeText={setNewKey} />
          </Field>
        </View>
        <View style={styles.value}>
          <Field label="Value">
            <Input value={newValue} keyboardType="numeric" onChangeText={setNewValue} />
          </Field>
        </View>
        <ThemeTokenAction label="Add" onPress={addSize} />
      </View>
    </Card>
  );
}

function SizeRow(props: {
  readonly tokenKey: string;
  readonly value: number;
  readonly authored: boolean;
  readonly onChange: (value: number | undefined) => void;
}) {
  return (
    <View style={styles.row}>
      <View style={styles.grow}>
        <Field label={props.tokenKey}>
          <Input
            value={String(props.value)}
            keyboardType="numeric"
            onChangeText={(text) => {
              const value = parseNonNegativeNumber(text);
              if (value !== null) props.onChange(value);
            }}
          />
        </Field>
      </View>
      {props.authored ? (
        <ThemeTokenAction label="Reset" onPress={() => props.onChange(undefined)} />
      ) : null}
    </View>
  );
}

function parseNonNegativeNumber(value: string): number | null {
  if (value.trim() === '') return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : null;
}

const styles = StyleSheet.create({
  list: { gap: 12 },
  row: { flexDirection: 'row', alignItems: 'flex-end', gap: 12 },
  addRow: { flexDirection: 'row', alignItems: 'flex-end', gap: 12, marginTop: 16 },
  grow: { flex: 1 },
  value: { width: 140 },
});
