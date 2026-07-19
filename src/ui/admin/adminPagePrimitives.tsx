import { Card, Heading, Text, useZoraTheme } from '@ankhorage/zora';
import React from 'react';
import { ScrollView, StyleSheet, TextInput, View } from 'react-native';

export function AdminScroll({ children }: { readonly children: React.ReactNode }) {
  return <ScrollView contentContainerStyle={styles.content}>{children}</ScrollView>;
}

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

export function Metric(props: { readonly title: string; readonly value: string }) {
  return (
    <Card compact title={props.title}>
      <Heading level={3}>{props.value}</Heading>
    </Card>
  );
}

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
