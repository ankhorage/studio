import { Card, Text } from '@ankhorage/zora';
import React from 'react';

import { AdminHeader, AdminScroll } from '../adminPagePrimitives';
import { ThemeTypographyHeadingEditor } from './ThemeTypographyHeadingEditor';
import { ThemeTypographySizeEditor } from './ThemeTypographySizeEditor';
import { ThemeTypographyWeightEditor } from './ThemeTypographyWeightEditor';
import { useActiveThemeAdmin } from './useActiveThemeAdmin';

/*** Compose heading, type-size, and font-weight editors for the active theme's global typography token set. */
export function ThemeTypographyAdminPage() {
  const { selection } = useActiveThemeAdmin();
  return (
    <AdminScroll>
      <AdminHeader
        title="Typography"
        description="Edit theme-global type scales and semantic weights shared across runtime modes."
      />
      {selection ? (
        <>
          <ThemeTypographyHeadingEditor />
          <ThemeTypographySizeEditor />
          <ThemeTypographyWeightEditor />
        </>
      ) : (
        <Card title="Theme unavailable">
          <Text color="neutral" emphasis="muted">
            The Studio manifest does not contain a valid active theme.
          </Text>
        </Card>
      )}
    </AdminScroll>
  );
}
