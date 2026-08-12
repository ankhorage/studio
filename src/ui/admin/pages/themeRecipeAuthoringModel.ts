import type {
  ThemeRecipeFieldOverrides,
  ThemeRecipeOverrides,
  ThemeRecipeOverrideValue,
} from '@ankhorage/contracts';

export type ThemeRecipeAuthoringKind = 'component' | 'pattern';

export function updateThemeRecipeField(args: {
  readonly recipes: ThemeRecipeOverrides | undefined;
  readonly kind: ThemeRecipeAuthoringKind;
  readonly recipeName: string;
  readonly fieldName: string;
  readonly value: ThemeRecipeOverrideValue | undefined;
}): ThemeRecipeOverrides | undefined {
  const bucketName = args.kind === 'component' ? 'components' : 'patterns';
  const bucket = args.recipes?.[bucketName];
  const fields = updateField(bucket?.[args.recipeName], args.fieldName, args.value);
  const nextBucket = updateRecord(bucket, args.recipeName, fields);
  const nextRecipes = { ...args.recipes, [bucketName]: nextBucket };
  return nextRecipes.components || nextRecipes.patterns ? nextRecipes : undefined;
}

function updateField(
  fields: ThemeRecipeFieldOverrides | undefined,
  fieldName: string,
  value: ThemeRecipeOverrideValue | undefined,
): ThemeRecipeFieldOverrides | undefined {
  return updateRecord(fields, fieldName, value);
}

function updateRecord<T>(
  record: Readonly<Record<string, T>> | undefined,
  key: string,
  value: T | undefined,
): Readonly<Record<string, T>> | undefined {
  const next = { ...record };
  if (value === undefined) delete next[key];
  else next[key] = value;
  return Object.keys(next).length > 0 ? next : undefined;
}
