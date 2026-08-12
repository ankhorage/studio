import type { ThemeRecipeOverrideValue } from '@ankhorage/contracts';
import { Card, Text, useZoraTheme, ZORA_THEME_RECIPE_META } from '@ankhorage/zora';
import React from 'react';
import { View } from 'react-native';

import { AdminHeader, AdminScroll } from '../adminPagePrimitives';
import { ThemeRecipeFieldEditor } from './ThemeRecipeFieldEditor';
import {
  type ThemeRecipeAuthoringKind,
  updateThemeRecipeField,
} from './themeRecipeAuthoringModel';
import { resolveThemeRecipeTokenOptions } from './themeRecipeTokenOptions';
import { useActiveThemeAdmin } from './useActiveThemeAdmin';

export function ThemeRecipeAdminPage(props: {
  readonly kind: ThemeRecipeAuthoringKind;
  readonly recipeName: string | null;
}) {
  const { theme: runtimeTheme } = useZoraTheme();
  const { selection, updateTheme } = useActiveThemeAdmin();
  const recipeName = props.recipeName;
  const entry = recipeName
    ? Object.entries(ZORA_THEME_RECIPE_META).find(([name]) => name === recipeName)
    : undefined;
  const meta = entry?.[1];

  if (!selection) return <Unavailable message="No canonical active theme is available." />;
  if (!meta || meta.kind !== props.kind || !recipeName) {
    return <Unavailable message="The requested ZORA Theme recipe is not available." />;
  }

  const bucket =
    props.kind === 'component'
      ? selection.theme.recipes?.components
      : selection.theme.recipes?.patterns;
  const overrides = bucket?.[recipeName];
  const updateField = (fieldName: string, value: ThemeRecipeOverrideValue | undefined) => {
    updateTheme({
      recipes: updateThemeRecipeField({
        recipes: selection.theme.recipes,
        kind: props.kind,
        recipeName,
        fieldName,
        value,
      }),
    });
  };

  return (
    <AdminScroll>
      <AdminHeader
        title={meta.name}
        description={meta.description ?? `Edit inherited ${meta.kind} Theme defaults.`}
      />
      <Card title={`${meta.kind === 'component' ? 'Component' : 'Pattern'} recipe`}>
        <View style={{ gap: 16 }}>
          {Object.entries(meta.fields).map(([fieldName, fieldMeta]) => (
            <ThemeRecipeFieldEditor
              key={fieldName}
              fieldName={fieldName}
              meta={fieldMeta}
              override={overrides?.[fieldName]}
              tokenOptions={
                fieldMeta.type === 'token'
                  ? resolveThemeRecipeTokenOptions(runtimeTheme, fieldMeta.tokenFamily)
                  : []
              }
              onChange={(value) => updateField(fieldName, value)}
            />
          ))}
        </View>
      </Card>
      <Text color="neutral" emphasis="muted" variant="caption">
        Inherited fields are omitted from the manifest and continue to follow ZORA owner defaults.
      </Text>
    </AdminScroll>
  );
}

function Unavailable(props: { readonly message: string }) {
  return (
    <AdminScroll>
      <AdminHeader title="Theme recipe unavailable" description={props.message} />
    </AdminScroll>
  );
}
