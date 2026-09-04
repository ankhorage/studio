import type { ThemeRecipeOverrideValue } from '@ankhorage/contracts';
import type { ZoraThemeRecipeFieldMeta } from '@ankhorage/zora';
import { Text, useZoraTheme } from '@ankhorage/zora';
import React from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { Field } from '../adminPagePrimitives';

/*** Render inherited and explicit override choices for one metadata-described ZORA theme recipe field. */
export function ThemeRecipeFieldEditor(props: {
  readonly fieldName: string;
  readonly meta: ZoraThemeRecipeFieldMeta;
  readonly override: ThemeRecipeOverrideValue | undefined;
  readonly tokenOptions: readonly string[];
  readonly onChange: (value: ThemeRecipeOverrideValue | undefined) => void;
}) {
  const options = resolveFieldOptions(props.meta, props.tokenOptions);
  return (
    <Field label={props.meta.label}>
      {props.meta.description ? (
        <Text color="neutral" emphasis="muted" variant="caption">
          {props.meta.description}
        </Text>
      ) : null}
      <View style={styles.choices}>
        <Choice
          label={formatInheritedLabel(props.meta)}
          selected={props.override === undefined}
          onPress={() => props.onChange(undefined)}
        />
        {options.map((option) => (
          <Choice
            key={String(option.value)}
            label={option.label}
            selected={props.override === option.value}
            onPress={() => props.onChange(option.value)}
          />
        ))}
      </View>
    </Field>
  );
}

/*** Resolve boolean, explicit-choice, or token metadata into selectable theme recipe override options. */
function resolveFieldOptions(
  meta: ZoraThemeRecipeFieldMeta,
  tokenOptions: readonly string[],
): readonly { readonly label: string; readonly value: ThemeRecipeOverrideValue }[] {
  if (meta.type === 'boolean') {
    return [
      { label: 'On', value: true },
      { label: 'Off', value: false },
    ];
  }
  const options = meta.type === 'choice' ? meta.options : tokenOptions;
  return options.map((value) => ({ label: value, value }));
}

/*** Format the inherited recipe field option and include its owner default when one exists. */
function formatInheritedLabel(meta: ZoraThemeRecipeFieldMeta): string {
  if (meta.default === undefined) return 'Inherited';
  return `Inherited (${String(meta.default)})`;
}

/*** Render one selectable theme recipe override option. */
function Choice(props: {
  readonly label: string;
  readonly selected: boolean;
  readonly onPress: () => void;
}) {
  const { theme } = useZoraTheme();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ selected: props.selected }}
      onPress={props.onPress}
      style={[
        styles.choice,
        { borderColor: props.selected ? theme.colors.primary : theme.colors.border },
      ]}
    >
      <Text color={props.selected ? 'primary' : 'neutral'} variant="bodySmall">
        {props.label}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  choices: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  choice: {
    borderWidth: 1,
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 7,
  },
});
