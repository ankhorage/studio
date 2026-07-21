import type { AppCategory } from '@ankhorage/contracts';
import { Heading, Icon, Text, useZoraTheme } from '@ankhorage/zora';
import React, { useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  type TextInputProps,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import type { StudioProjectSummary } from '../../projectWorkspaceContracts';
import type { TemplateCatalogCategory, TemplateEntry } from '../../templateCatalogContracts';

export { styles };

export function WorkspaceScreen(props: {
  title: string;
  subtitle: string;
  children: React.ReactNode;
}) {
  const { theme } = useZoraTheme();

  return (
    <SafeAreaView
      edges={['left', 'right', 'bottom']}
      style={[styles.safeArea, { backgroundColor: theme.colors.background }]}
    >
      <ScrollView style={styles.scroll} contentContainerStyle={styles.screenContent}>
        <View style={styles.screenHeader}>
          <Heading level={1} text={props.title} />
          <Text color="neutral" emphasis="muted">
            {props.subtitle}
          </Text>
        </View>
        {props.children}
      </ScrollView>
    </SafeAreaView>
  );
}

export function ThemedWorkspaceTextInput(props: TextInputProps) {
  const { theme } = useZoraTheme();
  const [focused, setFocused] = useState(false);
  const { onBlur, onFocus, style, ...inputProps } = props;

  return (
    <TextInput
      {...inputProps}
      onBlur={(event) => {
        setFocused(false);
        onBlur?.(event);
      }}
      onFocus={(event) => {
        setFocused(true);
        onFocus?.(event);
      }}
      placeholderTextColor={theme.colors.textMuted}
      style={[
        styles.searchInput,
        {
          color: theme.colors.text,
          backgroundColor: theme.colors.surface,
          borderColor: focused ? theme.colors.primary : theme.colors.border,
        },
        style,
      ]}
    />
  );
}

export function ProjectOverviewCard(props: { project: StudioProjectSummary; onPress: () => void }) {
  const { theme } = useZoraTheme();
  const [focused, setFocused] = useState(false);
  const mode = props.project.activeThemeMode ?? 'light';
  const accent = props.project.activeTheme[mode].primaryColor;

  return (
    <Pressable
      onPress={props.onPress}
      onFocus={() => setFocused(true)}
      onBlur={() => setFocused(false)}
      accessibilityRole="button"
      accessibilityLabel={`Open ${props.project.name}`}
      style={({ pressed }) => [
        styles.projectCard,
        {
          borderColor: focused ? theme.colors.primary : theme.colors.border,
          backgroundColor: theme.colors.surface,
          opacity: pressed ? 0.82 : 1,
        },
      ]}
    >
      <View style={[styles.themeStripe, { backgroundColor: accent }]} />
      <View style={styles.cardBody}>
        <Text numberOfLines={1} variant="bodySmall" weight="semiBold">
          {props.project.name}
        </Text>
        <Text color="neutral" emphasis="muted" variant="caption">
          {props.project.version} · {formatCategory(props.project.category)}
        </Text>
        <Text color="neutral" emphasis="muted" variant="caption">
          Updated {formatDate(props.project.updated)}
        </Text>
      </View>
    </Pressable>
  );
}

export function CategoryCard(props: { category: TemplateCatalogCategory; onPress: () => void }) {
  const { theme } = useZoraTheme();
  const [focused, setFocused] = useState(false);

  return (
    <Pressable
      onPress={props.onPress}
      onFocus={() => setFocused(true)}
      onBlur={() => setFocused(false)}
      accessibilityRole="button"
      accessibilityLabel={`Browse ${props.category.label} templates`}
      style={({ pressed }) => [
        styles.categoryCard,
        {
          borderColor: focused ? theme.colors.primary : theme.colors.border,
          backgroundColor: theme.colors.surface,
          opacity: pressed ? 0.82 : 1,
        },
      ]}
    >
      <View style={[styles.categoryAccent, { backgroundColor: props.category.primaryColor }]} />
      <Text numberOfLines={1} weight="semiBold">
        {props.category.label}
      </Text>
      <Text color="neutral" emphasis="muted" variant="bodySmall">
        {props.category.summary}
      </Text>
      <Text color="neutral" emphasis="muted" variant="caption">
        {props.category.templateCount} templates
      </Text>
    </Pressable>
  );
}

export function TemplateCard(props: {
  template: { name: string; description: string };
  onPress: () => void;
}) {
  const { theme } = useZoraTheme();
  const [focused, setFocused] = useState(false);

  return (
    <Pressable
      onPress={props.onPress}
      onFocus={() => setFocused(true)}
      onBlur={() => setFocused(false)}
      accessibilityRole="button"
      accessibilityLabel={`Select ${props.template.name}`}
      style={({ pressed }) => [
        styles.templateCard,
        {
          borderColor: focused ? theme.colors.primary : theme.colors.border,
          backgroundColor: theme.colors.surface,
          opacity: pressed ? 0.82 : 1,
        },
      ]}
    >
      <Text numberOfLines={1} weight="semiBold">
        {props.template.name}
      </Text>
      <Text color="neutral" emphasis="muted" variant="bodySmall">
        {props.template.description}
      </Text>
    </Pressable>
  );
}

export function SearchResults(props: {
  query: string;
  results: TemplateEntry[];
  onClear: () => void;
  onPress: (template: TemplateEntry) => void;
}) {
  return (
    <View style={styles.actionStack}>
      <View style={styles.resultsHeader}>
        <Text color="neutral" emphasis="muted">
          {props.results.length} results for "{props.query}"
        </Text>
        <SecondaryAction label="Clear search" onPress={props.onClear} />
      </View>
      {props.results.length === 0 ? (
        <EmptyState
          title="No matching templates"
          detail="Search by template name, description, category label, or category ID."
          actionLabel="Clear search"
          onAction={props.onClear}
        />
      ) : (
        <View style={styles.templateGrid}>
          {props.results.map((template) => (
            <TemplateCard
              key={template.id}
              template={{
                name: template.name,
                description: `${template.categoryLabel}: ${template.description}`,
              }}
              onPress={() => props.onPress(template)}
            />
          ))}
        </View>
      )}
    </View>
  );
}

export function LifecycleAction(props: {
  iconName: string;
  label: string;
  detail: string;
  loading: boolean;
  disabled: boolean;
  destructive?: boolean;
  onPress: () => void;
}) {
  const { theme } = useZoraTheme();
  const [focused, setFocused] = useState(false);

  return (
    <Pressable
      onPress={props.onPress}
      onFocus={() => setFocused(true)}
      onBlur={() => setFocused(false)}
      disabled={props.disabled}
      accessibilityRole="button"
      accessibilityLabel={props.label}
      style={({ pressed }) => [
        styles.lifecycleAction,
        {
          borderColor: focused ? theme.colors.primary : theme.colors.border,
          backgroundColor: theme.colors.surface,
          opacity: props.disabled && !props.loading ? 0.55 : pressed ? 0.82 : 1,
        },
      ]}
    >
      {props.loading ? (
        <ActivityIndicator />
      ) : (
        <Icon name={props.iconName} size={20} color={props.destructive ? 'error' : 'primary'} />
      )}
      <View style={styles.lifecycleCopy}>
        <Text weight="semiBold">{props.label}</Text>
        <Text color="neutral" emphasis="muted" variant="caption">
          {props.detail}
        </Text>
      </View>
    </Pressable>
  );
}

export function PrimaryAction(props: {
  iconName: string;
  label: string;
  disabled?: boolean;
  onPress: () => void;
}) {
  const { theme } = useZoraTheme();
  const [focused, setFocused] = useState(false);

  return (
    <Pressable
      onPress={props.onPress}
      onFocus={() => setFocused(true)}
      onBlur={() => setFocused(false)}
      disabled={props.disabled}
      accessibilityRole="button"
      accessibilityLabel={props.label}
      style={({ pressed }) => [
        styles.primaryAction,
        {
          backgroundColor: theme.colors.primary,
          borderColor: focused ? theme.colors.text : theme.colors.primary,
          opacity: props.disabled ? 0.48 : pressed ? 0.82 : 1,
        },
      ]}
    >
      <Icon name={props.iconName} size={18} color="#fff" />
      <Text color="neutral" emphasis="inverse" weight="semiBold">
        {props.label}
      </Text>
    </Pressable>
  );
}

export function SecondaryAction(props: { label: string; onPress: () => void }) {
  const { theme } = useZoraTheme();
  const [focused, setFocused] = useState(false);

  return (
    <Pressable
      onPress={props.onPress}
      onFocus={() => setFocused(true)}
      onBlur={() => setFocused(false)}
      accessibilityRole="button"
      accessibilityLabel={props.label}
      style={({ pressed }) => [
        styles.secondaryAction,
        {
          borderColor: focused ? theme.colors.primary : theme.colors.border,
          opacity: pressed ? 0.82 : 1,
        },
      ]}
    >
      <Text weight="semiBold">{props.label}</Text>
    </Pressable>
  );
}

export function SegmentedControl<TValue extends string>(props: {
  value: TValue;
  options: readonly { label: string; value: TValue }[];
  onChange: (value: TValue) => void;
}) {
  const { theme } = useZoraTheme();

  return (
    <View style={[styles.segmented, { borderColor: theme.colors.border }]}>
      {props.options.map((option) => {
        const selected = option.value === props.value;
        return (
          <SegmentedOption
            key={option.value}
            option={option}
            selected={selected}
            onChange={props.onChange}
          />
        );
      })}
    </View>
  );
}

function SegmentedOption<TValue extends string>(props: {
  option: { label: string; value: TValue };
  selected: boolean;
  onChange: (value: TValue) => void;
}) {
  const { theme } = useZoraTheme();
  const [focused, setFocused] = useState(false);

  return (
    <Pressable
      onPress={() => props.onChange(props.option.value)}
      onFocus={() => setFocused(true)}
      onBlur={() => setFocused(false)}
      accessibilityRole="button"
      accessibilityState={{ selected: props.selected }}
      style={[
        styles.segment,
        props.selected ? { backgroundColor: theme.colors.primary } : undefined,
        focused ? { borderColor: theme.colors.primary, borderWidth: 1 } : undefined,
      ]}
    >
      <Text
        color={props.selected ? 'neutral' : 'neutral'}
        emphasis={props.selected ? 'inverse' : 'default'}
        variant="bodySmall"
        weight="semiBold"
      >
        {props.option.label}
      </Text>
    </Pressable>
  );
}

export function MetadataRows(props: { rows: readonly (readonly [string, string])[] }) {
  return (
    <View style={styles.metadata}>
      {props.rows.map(([label, value]) => (
        <View key={label} style={styles.metadataRow}>
          <Text color="neutral" emphasis="muted" variant="caption">
            {label}
          </Text>
          <Text selectable variant="bodySmall">
            {value}
          </Text>
        </View>
      ))}
    </View>
  );
}

export function InlineMessage(props: { tone: 'success' | 'error' | 'info'; text: string }) {
  const { theme } = useZoraTheme();
  const borderColor = props.tone === 'error' ? theme.colors.danger : theme.colors.primary;

  return (
    <View style={[styles.inlineMessage, { borderColor }]}>
      <Text color={props.tone === 'error' ? 'danger' : 'primary'} variant="bodySmall">
        {props.text}
      </Text>
    </View>
  );
}

export function LoadingState(props: { label: string }) {
  const { theme } = useZoraTheme();
  return (
    <View style={styles.emptyState}>
      <ActivityIndicator color={theme.colors.primary} />
      <Text color="neutral" emphasis="muted">
        {props.label}
      </Text>
    </View>
  );
}

export function EmptyState(props: {
  title: string;
  detail: string;
  actionLabel?: string;
  onAction?: () => void;
}) {
  const { theme } = useZoraTheme();
  return (
    <View style={[styles.emptyState, { borderColor: theme.colors.border }]}>
      <Text weight="semiBold">{props.title}</Text>
      <Text align="center" color="neutral" emphasis="muted">
        {props.detail}
      </Text>
      {props.actionLabel && props.onAction ? (
        <SecondaryAction label={props.actionLabel} onPress={props.onAction} />
      ) : null}
    </View>
  );
}

export function formatCategory(category: AppCategory): string {
  return category
    .split('_')
    .map((part) => `${part.charAt(0).toUpperCase()}${part.slice(1)}`)
    .join(' ');
}

export function formatDate(value: string | undefined): string {
  if (!value) return 'Not recorded';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString();
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
  },
  scroll: {
    flex: 1,
  },
  screenContent: {
    width: '100%',
    maxWidth: 1180,
    alignSelf: 'center',
    padding: 20,
    paddingBottom: 48,
    gap: 20,
  },
  screenHeader: {
    gap: 4,
  },
  toolbar: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: 12,
  },
  searchInput: {
    minWidth: 240,
    minHeight: 42,
    flexGrow: 1,
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  segmented: {
    flexDirection: 'row',
    borderWidth: 1,
    borderRadius: 8,
    overflow: 'hidden',
  },
  segment: {
    minHeight: 40,
    paddingHorizontal: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  primaryAction: {
    minHeight: 42,
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  secondaryAction: {
    minHeight: 38,
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  projectGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  projectCard: {
    width: 260,
    minHeight: 132,
    borderWidth: 1,
    borderRadius: 8,
    overflow: 'hidden',
  },
  themeStripe: {
    height: 5,
    width: '100%',
  },
  cardBody: {
    padding: 14,
    gap: 8,
  },
  categoryGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  categoryCard: {
    width: 260,
    minHeight: 158,
    borderWidth: 1,
    borderRadius: 8,
    padding: 14,
    gap: 8,
  },
  categoryAccent: {
    width: 32,
    height: 4,
    borderRadius: 2,
  },
  templateGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  templateCard: {
    width: 280,
    minHeight: 118,
    borderWidth: 1,
    borderRadius: 8,
    padding: 14,
    gap: 8,
  },
  detailLayout: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 16,
    alignItems: 'flex-start',
  },
  createLayout: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 16,
    alignItems: 'flex-start',
  },
  detailPanel: {
    minWidth: 300,
    flex: 1,
    gap: 14,
  },
  lifecyclePanel: {
    minWidth: 300,
    flex: 1,
    gap: 14,
  },
  actionStack: {
    gap: 10,
  },
  lifecycleAction: {
    minHeight: 72,
    borderWidth: 1,
    borderRadius: 8,
    padding: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  lifecycleCopy: {
    flex: 1,
    gap: 2,
  },
  metadata: {
    gap: 8,
  },
  metadataRow: {
    gap: 2,
  },
  inlineMessage: {
    borderWidth: 1,
    borderRadius: 8,
    padding: 10,
  },
  emptyState: {
    minHeight: 160,
    borderWidth: 1,
    borderStyle: 'dashed',
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
    gap: 12,
  },
  fieldGroup: {
    gap: 8,
  },
  resultsHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
    flexWrap: 'wrap',
  },
});
