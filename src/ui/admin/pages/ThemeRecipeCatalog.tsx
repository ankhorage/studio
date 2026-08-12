import type { ZoraThemeRecipeKind } from '@ankhorage/zora';
import { Card, Text, useZoraTheme, ZORA_THEME_RECIPE_META } from '@ankhorage/zora';
import { useRouter } from 'expo-router';
import React from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { createStudioThemeRecipeRoutePath } from '../../../studioAdminRouteModel';

export function ThemeRecipeCatalog() {
  const router = useRouter();
  return (
    <View style={styles.catalog}>
      <RecipeGroup
        kind="component"
        onOpen={(name) => router.push(createStudioThemeRecipeRoutePath('component', name))}
      />
      <RecipeGroup
        kind="pattern"
        onOpen={(name) => router.push(createStudioThemeRecipeRoutePath('pattern', name))}
      />
    </View>
  );
}

function RecipeGroup(props: {
  readonly kind: ZoraThemeRecipeKind;
  readonly onOpen: (name: string) => void;
}) {
  const entries = Object.entries(ZORA_THEME_RECIPE_META).filter(
    ([, meta]) => meta.kind === props.kind,
  );
  return (
    <Card title={props.kind === 'component' ? 'Components' : 'Patterns'}>
      <View style={styles.list}>
        {entries.map(([name, meta]) => (
          <RecipeLink
            key={name}
            name={meta.name}
            description={meta.description}
            onPress={() => props.onOpen(name)}
          />
        ))}
      </View>
    </Card>
  );
}

function RecipeLink(props: {
  readonly name: string;
  readonly description: string | undefined;
  readonly onPress: () => void;
}) {
  const { theme } = useZoraTheme();
  return (
    <Pressable
      accessibilityRole="button"
      onPress={props.onPress}
      style={[styles.link, { borderColor: theme.colors.border }]}
    >
      <Text weight="semiBold">{props.name}</Text>
      {props.description ? (
        <Text color="neutral" emphasis="muted" variant="caption">
          {props.description}
        </Text>
      ) : null}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  catalog: { gap: 16 },
  list: { gap: 8 },
  link: { borderWidth: 1, borderRadius: 8, padding: 12, gap: 4 },
});
