import type {
  ThemeGlobalTokenOverrides,
  ThemeTypographyHeadingOverrides,
  ThemeTypographyTokenOverrides,
} from '@ankhorage/contracts';

export type NumericThemeTokenFamily = 'spacing' | 'radii' | 'shadows';

export function updateNumericThemeToken(args: {
  readonly tokens: ThemeGlobalTokenOverrides | undefined;
  readonly family: NumericThemeTokenFamily;
  readonly key: string;
  readonly value: number | undefined;
}): ThemeGlobalTokenOverrides | undefined {
  const nextFamily = updateRecordValue(args.tokens?.[args.family], args.key, args.value);
  return normalizeGlobalTokens({ ...args.tokens, [args.family]: nextFamily });
}

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

export function updateTypographyHeading(args: {
  readonly tokens: ThemeGlobalTokenOverrides | undefined;
  readonly level: string;
  readonly field: keyof ThemeTypographyHeadingOverrides;
  readonly value: number | string | undefined;
}): ThemeGlobalTokenOverrides | undefined {
  const headings = args.tokens?.typography?.headings;
  const heading = updateRecordValue(headings?.[args.level], args.field, args.value);
  return updateTypographyTokens(args.tokens, {
    ...args.tokens?.typography,
    headings: updateRecordValue(headings, args.level, heading),
  });
}

function updateTypographyTokens(
  tokens: ThemeGlobalTokenOverrides | undefined,
  typography: ThemeTypographyTokenOverrides,
): ThemeGlobalTokenOverrides | undefined {
  return normalizeGlobalTokens({ ...tokens, typography: normalizeTypography(typography) });
}

function updateRecordValue<T>(
  record: Readonly<Record<string, T>> | undefined,
  key: string,
  value: T | undefined,
): Readonly<Record<string, T>> | undefined {
  const next = { ...record };
  if (value === undefined) delete next[key];
  else next[key] = value;
  return Object.keys(next).length > 0 ? next : undefined;
}

function normalizeTypography(
  typography: ThemeTypographyTokenOverrides,
): ThemeTypographyTokenOverrides | undefined {
  const { headings, sizes, weights } = typography;
  if (!headings && !sizes && !weights) return undefined;
  return typography;
}

function normalizeGlobalTokens(
  tokens: ThemeGlobalTokenOverrides,
): ThemeGlobalTokenOverrides | undefined {
  const { spacing, radii, typography, shadows } = tokens;
  return spacing || radii || typography || shadows ? tokens : undefined;
}
