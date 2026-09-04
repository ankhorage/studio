import type {
  ThemeGlobalTokenOverrides,
  ThemeTypographyHeadingOverrides,
  ThemeTypographyTokenOverrides,
} from '@ankhorage/contracts';
import { deleteOwnProperty, readOwnProperty, setOwnProperty } from '@ankhorage/utility/object';

export type NumericThemeTokenFamily = 'spacing' | 'radii' | 'shadows';

/*** Immutably set/remove one numeric global theme token and prune empty family/global override structures. */
export function updateNumericThemeToken(args: {
  readonly tokens: ThemeGlobalTokenOverrides | undefined;
  readonly family: NumericThemeTokenFamily;
  readonly key: string;
  readonly value: number | undefined;
}): ThemeGlobalTokenOverrides | undefined {
  const family = args.tokens
    ? readOwnProperty<Readonly<Record<string, number>>>(args.tokens, args.family)
    : undefined;
  const nextFamily = updateRecordValue(family, args.key, args.value);
  const nextTokens: ThemeGlobalTokenOverrides = { ...args.tokens };
  if (nextFamily) setOwnProperty(nextTokens, args.family, nextFamily);
  else deleteOwnProperty(nextTokens, args.family);
  return normalizeGlobalTokens(nextTokens);
}

/*** Immutably set/remove one typography size override and prune empty typography/global override structures. */
export function updateTypographySize(args: {
  readonly tokens: ThemeGlobalTokenOverrides | undefined;
  readonly key: string;
  readonly value: number | undefined;
}): ThemeGlobalTokenOverrides | undefined {
  return updateTypographyTokens(args.tokens, {
    ...args.tokens?.typography,
    sizes: updateRecordValue(args.tokens?.typography?.sizes, args.key, args.value),
  });
}

/*** Immutably set/remove one typography weight override and prune empty typography/global override structures. */
export function updateTypographyWeight(args: {
  readonly tokens: ThemeGlobalTokenOverrides | undefined;
  readonly key: string;
  readonly value: string | undefined;
}): ThemeGlobalTokenOverrides | undefined {
  return updateTypographyTokens(args.tokens, {
    ...args.tokens?.typography,
    weights: updateRecordValue(args.tokens?.typography?.weights, args.key, args.value),
  });
}

/*** Immutably set/remove one typography heading field override and prune empty heading/typography/global structures. */
export function updateTypographyHeading(args: {
  readonly tokens: ThemeGlobalTokenOverrides | undefined;
  readonly level: string;
  readonly field: keyof ThemeTypographyHeadingOverrides;
  readonly value: number | string | undefined;
}): ThemeGlobalTokenOverrides | undefined {
  const headings = args.tokens?.typography?.headings;
  const current = headings
    ? (readOwnProperty<ThemeTypographyHeadingOverrides>(headings, args.level) ?? {})
    : {};
  const nextHeading = { ...current };
  if (args.value === undefined) deleteOwnProperty(nextHeading, args.field);
  else setOwnProperty(nextHeading, args.field, args.value);
  const nextHeadings = updateRecordValue(
    headings,
    args.level,
    Object.keys(nextHeading).length > 0 ? nextHeading : undefined,
  );
  return updateTypographyTokens(args.tokens, {
    ...args.tokens?.typography,
    headings: nextHeadings,
  });
}

/*** Replace typography overrides and normalize empty typography/global token structures. */
function updateTypographyTokens(
  tokens: ThemeGlobalTokenOverrides | undefined,
  typography: ThemeTypographyTokenOverrides,
): ThemeGlobalTokenOverrides | undefined {
  return normalizeGlobalTokens({ ...tokens, typography: normalizeTypography(typography) });
}

/***
 * Immutably set/delete a keyed record value and normalize an empty resulting record to undefined.
 * @utility @ankhorage/utility/object
 */
function updateRecordValue<T>(
  record: Readonly<Record<string, T>> | undefined,
  key: string,
  value: T | undefined,
): Readonly<Record<string, T>> | undefined {
  const next = { ...record };
  if (value === undefined) deleteOwnProperty(next, key);
  else setOwnProperty(next, key, value);
  return Object.keys(next).length > 0 ? next : undefined;
}

/*** Normalize an empty typography override shell to undefined. */
function normalizeTypography(
  typography: ThemeTypographyTokenOverrides,
): ThemeTypographyTokenOverrides | undefined {
  const { headings, sizes, weights } = typography;
  if (!headings && !sizes && !weights) return undefined;
  return typography;
}

/*** Normalize an empty global theme-token override shell to undefined. */
function normalizeGlobalTokens(
  tokens: ThemeGlobalTokenOverrides,
): ThemeGlobalTokenOverrides | undefined {
  const { spacing, radii, typography, shadows } = tokens;
  return spacing || radii || typography || shadows ? tokens : undefined;
}
