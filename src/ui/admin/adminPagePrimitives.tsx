import { Card, Heading, Text, useZoraTheme } from '@ankhorage/zora';
import React from 'react';
import { ScrollView, StyleSheet, TextInput, View } from 'react-native';

/***
 * Render scrollable administration page content with Studio's shared page spacing and width constraints.
 * @todo Prefer a canonical ZORA page/scroll layout primitive if this layout is generally useful; Studio should not own a parallel design-system primitive set.
 */
export function AdminScroll({ children }: { readonly children: React.ReactNode }) {
  return <ScrollView contentContainerStyle={styles.content}>{children}</ScrollView>;
}

/***
 * Render the common title/description header used by Studio administration pages.
 * @todo Prefer a canonical ZORA page-header pattern instead of maintaining Studio-specific generic UI primitives.
 */
export function AdminHeader(props: { readonly title: string; readonly description: string }) {
  return (
    <View style={styles.pageHeader}>
      <Heading level={2} text={props.title} />
      <Text color="neutral" emphasis="muted" variant="bodySmall">
        {props.description}
      </Text>
    </View>
  );
}

/***
 * Render a compact labeled metric card for administration dashboards.
 * @todo Promote/consume a ZORA metric/stat pattern rather than owning a generic visual primitive in Studio.
 */
export function Metric(props: { readonly title: string; readonly value: string }) {
  return (
    <Card compact title={props.title}>
      <Heading level={3}>{props.value}</Heading>
    </Card>
  );
}

/***
 * Render a labeled field wrapper for Studio admin forms.
 * @todo Replace with the canonical ZORA FormField pattern where possible.
 */
export function Field(props: { readonly label: string; readonly children: React.ReactNode }) {
  return (
    <View style={styles.field}>
      <Text variant="bodySmall" weight="semiBold">
        {props.label}
      </Text>
      {props.children}
    </View>
  );
}

/***
 * Render a theme-aware React Native text input for Studio administration forms.
 * @todo Replace with the canonical ZORA Input component/pattern rather than duplicating focus-independent input styling in Studio.
 */
export function Input(props: React.ComponentProps<typeof TextInput>) {
  const { theme } = useZoraTheme();
  return (
    <TextInput
      {...props}
      placeholderTextColor={theme.colors.textMuted}
      style={[
        styles.input,
        {
          color: theme.colors.text,
          backgroundColor: theme.colors.background,
          borderColor: theme.colors.border,
        },
        props.style,
      ]}
    />
  );
}

/***
 * Render one label/value metadata pair in Studio administration pages.
 * @todo Prefer a canonical ZORA key/value or definition-list pattern if available.
 */
export function KeyValue(props: { readonly label: string; readonly value: string }) {
  return (
    <View style={styles.keyValue}>
      <Text color="neutral" emphasis="muted" variant="bodySmall">
        {props.label}
      </Text>
      <Text weight="semiBold">{props.value}</Text>
    </View>
  );
}

export const adminPageStyles = StyleSheet.create({
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  row: {
    gap: 4,
    paddingVertical: 8,
  },
});

const styles = StyleSheet.create({
  content: {
    width: '100%',
    maxWidth: 1040,
    alignSelf: 'center',
    padding: 20,
    paddingBottom: 48,
    gap: 18,
  },
  pageHeader: {
    gap: 6,
  },
  field: {
    gap: 6,
  },
  input: {
    minHeight: 44,
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  keyValue: {
    gap: 4,
  },
});
