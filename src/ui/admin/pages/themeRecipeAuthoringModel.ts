import type {
  ThemeRecipeFieldOverrides,
  ThemeRecipeOverrides,
  ThemeRecipeOverrideValue,
} from '@ankhorage/contracts';

import { deleteOwnProperty } from '../../../utils/deleteOwnProperty';
import { readOwnProperty } from '../../../utils/readOwnProperty';
import { setOwnProperty } from '../../../utils/setOwnProperty';

export type ThemeRecipeAuthoringKind = 'component' | 'pattern';

export function updateThemeRecipeField(args: {
  readonly recipes: ThemeRecipeOverrides | undefined;
  readonly kind: ThemeRecipeAuthoringKind;
  readonly recipeName: string;
  readonly fieldName: string;
  readonly value: ThemeRecipeOverrideValue | undefined;
}): ThemeRecipeOverrides | undefined {
  const bucketName = args.kind === 'component' ? 'components' : 'patterns';
  const bucket = args.recipes
    ? readOwnProperty<Readonly<Record<string, ThemeRecipeFieldOverrides>>>(args.recipes, bucketName)
    : undefined;
  const currentFields = bucket
    ? readOwnProperty<ThemeRecipeFieldOverrides>(bucket, args.recipeName)
    : undefined;
  const fields = updateField(currentFields, args.fieldName, args.value);
  const nextBucket = updateRecord(bucket, args.recipeName, fields);
  const nextRecipes: ThemeRecipeOverrides = { ...args.recipes };
  if (nextBucket) setOwnProperty(nextRecipes, bucketName, nextBucket);
  else deleteOwnProperty(nextRecipes, bucketName);
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
  if (value === undefined) deleteOwnProperty(next, key);
  else setOwnProperty(next, key, value);
  return Object.keys(next).length > 0 ? next : undefined;
}
