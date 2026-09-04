import { Card, Text, useZoraTheme } from '@ankhorage/zora';
import React from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { Field } from '../adminPagePrimitives';
import { ThemeTokenAction } from './ThemeTokenAction';
import { updateTypographyWeight } from './themeTokenAuthoringModel';
import { useActiveThemeAdmin } from './useActiveThemeAdmin';

const FONT_WEIGHTS = [
  '100',
  '200',
  '300',
  '400',
  '500',
  '600',
  '700',
  '800',
  '900',
  'normal',
  'bold',
] as const;

/*** Render resolved typography weight tokens as selectable CSS/React Native font-weight values with reset-to-inherited controls. */
export function ThemeTypographyWeightEditor() {
  const { theme: resolvedTheme } = useZoraTheme();
  const { selection, updateTheme } = useActiveThemeAdmin();
  if (!selection) return null;

  /*** Set or remove one authored typography weight token. */
  const updateWeight = (key: string, value: string | undefined) => {
    updateTheme({
      tokens: updateTypographyWeight({ tokens: selection.theme.tokens, key, value }),
    });
  };

  return (
    <Card title="Font weights">
      <View style={styles.list}>
        {Object.entries(resolvedTheme.typography.weights).map(([key, value]) => (
          <WeightRow
            key={key}
            tokenKey={key}
            value={value}
            authored={selection.theme.tokens?.typography?.weights?.[key] !== undefined}
            onChange={(next) => updateWeight(key, next)}
          />
        ))}
      </View>
    </Card>
  );
}

/*** Render one typography weight token with explicit weight choices and reset-to-inherited behavior. */
function WeightRow(props: {
  readonly tokenKey: string;
  readonly value: string;
  readonly authored: boolean;
  readonly onChange: (value: string | undefined) => void;
}) {
  const { theme } = useZoraTheme();
  return (
    <Field label={props.tokenKey}>
      <View style={styles.row}>
        <View style={styles.choices}>
          {FONT_WEIGHTS.map((weight) => (
            <Pressable
              key={weight}
              accessibilityRole="button"
              accessibilityState={{ selected: weight === props.value }}
              onPress={() => props.onChange(weight)}
              style={[
                styles.choice,
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

const styles = StyleSheet.create({
  list: { gap: 14 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  choices: { flex: 1, flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  choice: {
    borderWidth: 1,
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
});
