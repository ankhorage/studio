import type { AppCategory } from '@ankhorage/contracts';
import { Heading, Icon, type IconProps, Text, useZoraTheme } from '@ankhorage/zora';
import React, { useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  TextInput,
  type TextInputProps,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import type { StudioProjectSummary } from '../../projectWorkspaceContracts';
import type { TemplateCatalogCategory, TemplateEntry } from '../../templateCatalogContracts';

export { styles };

type IoniconsIconName = Extract<IconProps, { provider?: 'Ionicons' }>['name'];

/***
 * Render the shared Studio workspace screen shell with safe-area, scrolling, title and subtitle composition.
 */
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

/***
 * Render a workspace text input with ZORA theme colors and local focus-border state.
 * @todo Prefer the canonical ZORA input primitive instead of maintaining a generic themed TextInput wrapper inside Studio when its behavior can be represented by ZORA.
 */
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

/***
 * Render one Studio project summary card with active-theme accent, project metadata and last-update label.
 */
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

/***
 * Render one template-catalog category card with category accent, summary and template count.
 */
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

/***
 * Render one selectable template summary card.
 */
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

/***
 * Render template search results, including count, clear action and an empty state when no templates match.
 */
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

/***
 * Render a workspace lifecycle operation card with loading, disabled and destructive presentation states.
 * @todo Consolidate this generic action presentation with ZORA button/action patterns instead of owning another reusable UI primitive inside Studio.
 */
export function LifecycleAction(props: {
  iconName: IoniconsIconName;
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

/***
 * Render the primary workspace action button with icon, disabled and focus/press states.
 * @todo Prefer the canonical ZORA Button API instead of maintaining a Studio-local generic primary button primitive.
 */
export function PrimaryAction(props: {
  iconName: IoniconsIconName;
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

/***
 * Render the secondary workspace action button with focus and press feedback.
 * @todo Prefer the canonical ZORA Button API instead of maintaining a Studio-local generic secondary button primitive.
 */
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

/***
 * Render a string-valued segmented selector from labeled options and forward the selected value.
 * @todo Move/reuse this generic segmented-control UI through ZORA if it is an intentional reusable design-system primitive rather than Studio workspace ownership.
 */
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

/***
 * Render one selectable option inside the workspace segmented control.
 * @todo Keep this implementation with the segmented-control owner if that primitive moves to ZORA.
 */
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

/***
 * Render labeled workspace metadata rows from string key/value pairs.
 */
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

/***
 * Render a compact workspace status message with tone-dependent border and text semantics.
 * @todo Prefer the canonical ZORA Notice/status primitive when it covers this presentation contract.
 */
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

/***
 * Render a centered workspace loading indicator and explanatory label.
 */
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

/***
 * Render an empty-state message with an optional secondary action.
 * @todo Replace this Studio-local duplicate with ZORA's canonical EmptyState pattern where its contract is sufficient.
 */
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

/***
 * Format an AppCategory identifier as the human label shown by Studio workspace UI.
 * @todo Move this small Studio-specific `finance_money` → `Finance & Money` convention into a real `src/utils/appCategory.ts` implementation and keep category display policy out of UI primitives.
 */
export function formatCategory(category: AppCategory): string {
  return category
    .split('_')
    .map((part) => `${part.charAt(0).toUpperCase()}${part.slice(1)}`)
    .join(' ');
}

/***
 * Format an optional date string for human display, preserving invalid input and using a fallback for missing values.
 * @utility @ankhorage/utility/date
 */
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
