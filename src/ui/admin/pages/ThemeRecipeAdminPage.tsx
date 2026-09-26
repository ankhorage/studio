import type { ThemeRecipeFieldOverrides } from '@ankhorage/contracts';
import { Card, Text, useZoraTheme, ZORA_THEME_RECIPE_META } from '@ankhorage/zora';
import React from 'react';

import { AuthoringEditor } from '../../../features/authoring-engine/adapters/inbound/AuthoringEditor';
import { resolveZoraThemeRecipeAuthoring } from '../../../features/authoring-engine/adapters/outbound/resolveZoraThemeRecipeAuthoring';
import { applyAuthoringMutation } from '../../../features/authoring-engine/application/use-cases/applyAuthoringMutation';
import { deriveAuthoringModel } from '../../../features/authoring-engine/application/use-cases/deriveAuthoringModel';
import type { AuthoringMutation } from '../../../types/authoring-engine';
import { AdminHeader, AdminScroll } from '../adminPagePrimitives';
import {
  type ThemeRecipeAuthoringKind,
  updateThemeRecipeOverrides,
} from './themeRecipeAuthoringModel';
import { resolveThemeRecipeTokenOptions } from './themeRecipeTokenOptions';
import { useActiveThemeAdmin } from './useActiveThemeAdmin';

/*** Render one ZORA component/pattern theme recipe and persist field overrides into the canonical active Studio theme. */
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
  const authoring = resolveZoraThemeRecipeAuthoring(meta, (family) =>
    resolveThemeRecipeTokenOptions(runtimeTheme, family),
  );
  const model = deriveAuthoringModel({ ...authoring, value: overrides });
  /*** Apply one recipe mutation through the central mutation engine before persisting the canonical Theme override object. */
  const updateRecipe = (mutation: AuthoringMutation) => {
    const current: ThemeRecipeFieldOverrides = overrides ?? {};
    const result = applyAuthoringMutation(current, mutation);
    if (!result.ok) return;
    updateTheme({
      recipes: updateThemeRecipeOverrides({
        recipes: selection.theme.recipes,
        kind: props.kind,
        recipeName,
        fields: result.value,
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
        <AuthoringEditor model={model} onMutation={updateRecipe} />
      </Card>
      <Text color="neutral" emphasis="muted" variant="caption">
        Inherited fields are omitted from the manifest and continue to follow ZORA owner defaults.
      </Text>
    </AdminScroll>
  );
}

/*** Render the theme-recipe fallback for missing active themes or invalid recipe metadata. */
function Unavailable(props: { readonly message: string }) {
  return (
    <AdminScroll>
      <AdminHeader title="Theme recipe unavailable" description={props.message} />
    </AdminScroll>
  );
}
