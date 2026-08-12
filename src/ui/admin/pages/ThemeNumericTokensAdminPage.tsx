import { Card, Text, useZoraTheme } from '@ankhorage/zora';
import React, { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { AdminHeader, AdminScroll, Field, Input } from '../adminPagePrimitives';
import { type NumericThemeTokenFamily, updateNumericThemeToken } from './themeTokenAuthoringModel';
import { useActiveThemeAdmin } from './useActiveThemeAdmin';

const COPY: Record<NumericThemeTokenFamily, { title: string; description: string }> = {
  spacing: { title: 'Spacing', description: 'Shared spacing tokens used by Theme recipes.' },
  radii: { title: 'Radii', description: 'Shared corner-radius tokens used by Theme recipes.' },
  shadows: {
    title: 'Shadows',
    description: 'Shared shadow-strength tokens used by Theme recipes.',
  },
};

export function ThemeNumericTokensAdminPage(props: { readonly family: NumericThemeTokenFamily }) {
  const { theme: resolvedTheme } = useZoraTheme();
  const { selection, updateTheme } = useActiveThemeAdmin();
  const [newKey, setNewKey] = useState('');
  const [newValue, setNewValue] = useState('');
  const copy = COPY[props.family];

  if (!selection) return <ThemeUnavailable />;
  const resolved = resolvedTheme[props.family];
  const authored = selection.theme.tokens?.[props.family];
  const updateValue = (key: string, value: number | undefined) => {
    const tokens = updateNumericThemeToken({
      tokens: selection.theme.tokens,
      family: props.family,
      key,
      value,
    });
    updateTheme({ tokens });
  };

  const addToken = () => {
    const key = newKey.trim();
    const value = parseNonNegativeNumber(newValue);
    if (!key || key === 'none' || value === null) return;
    updateValue(key, value);
    setNewKey('');
    setNewValue('');
  };

  return (
    <AdminScroll>
      <AdminHeader title={copy.title} description={copy.description} />
      <Card title={`${selection.theme.name} · ${copy.title}`}>
        <View style={styles.list}>
          {Object.entries(resolved).map(([key, value]) => (
            <NumericTokenRow
              key={key}
              tokenKey={key}
              value={value}
              authored={authored?.[key] !== undefined}
              locked={key === 'none'}
              onChange={(next) => updateValue(key, next)}
            />
          ))}
        </View>
      </Card>
      <Card title="Add token">
        <Field label="Token name">
          <Input value={newKey} autoCapitalize="none" onChangeText={setNewKey} />
        </Field>
        <Field label="Value">
          <Input value={newValue} keyboardType="numeric" onChangeText={setNewValue} />
        </Field>
        <Action label="Add token" onPress={addToken} />
      </Card>
    </AdminScroll>
  );
}

function NumericTokenRow(props: {
  readonly tokenKey: string;
  readonly value: number;
  readonly authored: boolean;
  readonly locked: boolean;
  readonly onChange: (value: number | undefined) => void;
}) {
  return (
    <View style={styles.row}>
      <View style={styles.rowInput}>
        <Field label={props.tokenKey}>
          <Input
            value={String(props.value)}
            editable={!props.locked}
            keyboardType="numeric"
            onChangeText={(text) => {
              const value = parseNonNegativeNumber(text);
              if (value !== null) props.onChange(value);
            }}
          />
        </Field>
      </View>
      {props.authored && !props.locked ? (
        <Action label="Reset" onPress={() => props.onChange(undefined)} />
      ) : null}
    </View>
  );
}

function Action(props: { readonly label: string; readonly onPress: () => void }) {
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

function ThemeUnavailable() {
  return (
    <AdminScroll>
      <AdminHeader
        title="Theme unavailable"
        description="No canonical active theme is available."
      />
    </AdminScroll>
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
  rowInput: { flex: 1 },
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
