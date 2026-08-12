import { Card, Text, useZoraTheme } from '@ankhorage/zora';
import React from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { Field, Input } from '../adminPagePrimitives';
import { ThemeTokenAction } from './ThemeTokenAction';
import { updateTypographyHeading } from './themeTokenAuthoringModel';
import { useActiveThemeAdmin } from './useActiveThemeAdmin';

const HEADING_WEIGHTS = ['regular', 'medium', 'semiBold', 'bold'] as const;

export function ThemeTypographyHeadingEditor() {
  const { theme: resolvedTheme } = useZoraTheme();
  const { selection, updateTheme } = useActiveThemeAdmin();
  if (!selection) return null;

  const updateHeading = (
    level: string,
    field: 'size' | 'lineHeight' | 'weight',
    value: number | string | undefined,
  ) => {
    updateTheme({
      tokens: updateTypographyHeading({
        tokens: selection.theme.tokens,
        level,
        field,
        value,
      }),
    });
  };

  return (
    <Card title="Headings">
      <View style={styles.list}>
        {Object.entries(resolvedTheme.typography.headings).map(([level, heading]) => (
          <HeadingRow
            key={level}
            level={level}
            heading={heading}
            authored={selection.theme.tokens?.typography?.headings?.[level]}
            onChange={(field, value) => updateHeading(level, field, value)}
          />
        ))}
      </View>
    </Card>
  );
}

function HeadingRow(props: {
  readonly level: string;
  readonly heading: { readonly size: number; readonly lineHeight: number; readonly weight: string };
  readonly authored:
    { readonly size?: number; readonly lineHeight?: number; readonly weight?: string } | undefined;
  readonly onChange: (
    field: 'size' | 'lineHeight' | 'weight',
    value: number | string | undefined,
  ) => void;
}) {
  return (
    <View style={styles.heading}>
      <Text weight="semiBold">Heading {props.level}</Text>
      <View style={styles.metrics}>
        <MetricInput
          label="Size"
          value={props.heading.size}
          authored={props.authored?.size !== undefined}
          onChange={(value) => props.onChange('size', value)}
        />
        <MetricInput
          label="Line height"
          value={props.heading.lineHeight}
          authored={props.authored?.lineHeight !== undefined}
          onChange={(value) => props.onChange('lineHeight', value)}
        />
      </View>
      <HeadingWeightChoice
        value={props.heading.weight}
        authored={props.authored?.weight !== undefined}
        onChange={(value) => props.onChange('weight', value)}
      />
    </View>
  );
}

function MetricInput(props: {
  readonly label: string;
  readonly value: number;
  readonly authored: boolean;
  readonly onChange: (value: number | undefined) => void;
}) {
  return (
    <View style={styles.metric}>
      <Field label={props.label}>
        <Input
          value={String(props.value)}
          keyboardType="numeric"
          onChangeText={(text) => {
            const value = parseNonNegativeNumber(text);
            if (value !== null) props.onChange(value);
          }}
        />
      </Field>
      {props.authored ? (
        <ThemeTokenAction label="Reset" onPress={() => props.onChange(undefined)} />
      ) : null}
    </View>
  );
}

function HeadingWeightChoice(props: {
  readonly value: string;
  readonly authored: boolean;
  readonly onChange: (value: string | undefined) => void;
}) {
  const { theme } = useZoraTheme();
  return (
    <Field label="Weight">
      <View style={styles.weightRow}>
        <View style={styles.weightChoices}>
          {HEADING_WEIGHTS.map((weight) => (
            <Pressable
              key={weight}
              accessibilityRole="button"
              accessibilityState={{ selected: weight === props.value }}
              onPress={() => props.onChange(weight)}
              style={[
                styles.weight,
                {
                  borderColor: weight === props.value ? theme.colors.primary : theme.colors.border,
                },
              ]}
            >
              <Text color={weight === props.value ? 'primary' : 'neutral'} variant="bodySmall">
                {weight}
              </Text>
            </Pressable>
          ))}
        </View>
        {props.authored ? (
          <ThemeTokenAction label="Reset" onPress={() => props.onChange(undefined)} />
        ) : null}
      </View>
    </Field>
  );
}

function parseNonNegativeNumber(value: string): number | null {
  if (value.trim() === '') return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : null;
}

const styles = StyleSheet.create({
  list: { gap: 18 },
  heading: { gap: 10 },
  metrics: { flexDirection: 'row', gap: 12 },
  metric: { flex: 1, flexDirection: 'row', alignItems: 'flex-end', gap: 8 },
  weightRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  weightChoices: { flex: 1, flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  weight: { borderWidth: 1, borderRadius: 999, paddingHorizontal: 10, paddingVertical: 6 },
});
