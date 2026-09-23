import { parseHexColorOrThrow } from '@ankhorage/color-theory';
import { Card, TextInput } from '@ankhorage/zora';
import React from 'react';

import {
  type AuthoringCustomControlProps,
  AuthoringEditor,
} from '../../../features/authoring-engine/adapters/inbound/AuthoringEditor';
import { applyThemeAuthoringMutation } from '../../../features/authoring-engine/adapters/outbound/applyThemeAuthoringMutation';
import { deriveThemeAuthoringModel } from '../../../features/authoring-engine/adapters/outbound/deriveThemeAuthoringModel';
import type {
  AuthoringMutation,
  AuthoringPresentationPolicy,
} from '../../../types/authoring-engine';
import { AdminHeader, AdminScroll } from '../adminPagePrimitives';
import { ThemeModeEditorSelector } from './ThemeModeEditorSelector';
import { useActiveThemeAdmin } from './useActiveThemeAdmin';

/*** Render primary-color and harmony authoring for the active light/dark runtime theme mode. */
export function ThemeColorsAdminPage() {
  const { replaceTheme, selection } = useActiveThemeAdmin();
  if (!selection) return <Unavailable />;

  const modePolicy: AuthoringPresentationPolicy =
    selection.mode === 'light'
      ? {
          fields: {
            light: {
              fields: {
                primaryColor: { editor: { kind: 'theme-hex-color' } },
              },
            },
          },
        }
      : {
          fields: {
            dark: {
              fields: {
                primaryColor: { editor: { kind: 'theme-hex-color' } },
              },
            },
          },
        };
  const model = deriveThemeAuthoringModel({
    theme: selection.theme,
    path: [selection.mode],
    policy: modePolicy,
  });

  /*** Apply one owner-derived mode mutation through the canonical Theme boundary. */
  const updateAuthoredTheme = (mutation: AuthoringMutation) => {
    const result = applyThemeAuthoringMutation(selection.theme, mutation);
    if (result.ok) replaceTheme(result.value);
  };

  return (
    <AdminScroll>
      <AdminHeader
        title="Colors"
        description="Edit the canonical color source for the runtime mode currently being previewed."
      />
      <ThemeModeEditorSelector />
      <Card title={`${selection.theme.name} · ${selection.mode === 'light' ? 'Light' : 'Dark'}`}>
        <AuthoringEditor
          model={model}
          onMutation={updateAuthoredTheme}
          renderCustomControl={renderThemeColorControl}
        />
      </Card>
    </AdminScroll>
  );
}

/*** Preserve incomplete color input locally while committing only valid Color Theory hex values. */
function renderThemeColorControl({
  model,
  onMutation,
}: AuthoringCustomControlProps): React.ReactNode | undefined {
  if (
    model.editor?.kind !== 'theme-hex-color' ||
    model.kind !== 'scalar' ||
    model.scalarType !== 'string'
  ) {
    return undefined;
  }

  return (
    <TextInput
      key={`${model.path.join('.')}:${String(model.value ?? '')}`}
      defaultValue={typeof model.value === 'string' ? model.value : ''}
      autoCapitalize="none"
      autoCorrect={false}
      maxLength={7}
      onChangeText={(primaryColor) => {
        try {
          parseHexColorOrThrow(primaryColor);
        } catch {
          return;
        }
        onMutation({ kind: 'set', path: model.path, value: primaryColor });
      }}
    />
  );
}

/*** Render the theme-colors fallback when no canonical active theme is available. */
function Unavailable() {
  return (
    <AdminScroll>
      <AdminHeader
        title="Theme unavailable"
        description="No canonical active theme is available."
      />
    </AdminScroll>
  );
}
