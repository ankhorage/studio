import type {
  ThemeRecipeFieldOverrides,
  ThemeRecipeOverrides,
  ThemeRecipeOverrideValue,
} from '@ankhorage/contracts';
import { deleteOwnProperty, readOwnProperty, setOwnProperty } from '@ankhorage/utility/object';

export type ThemeRecipeAuthoringKind = 'component' | 'pattern';

/***
 * Immutably set or remove one component/pattern recipe field override and prune empty recipe/bucket structures.
 * @todo Move this theme-recipe mutation policy from admin UI into the theme authoring domain.
 */
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

/*** Apply the generic record-update primitive to one theme recipe field map. */
function updateField(
  fields: ThemeRecipeFieldOverrides | undefined,
  fieldName: string,
  value: ThemeRecipeOverrideValue | undefined,
): ThemeRecipeFieldOverrides | undefined {
  return updateRecord(fields, fieldName, value);
}

/***
 * Immutably set/delete a keyed record value and normalize an empty resulting record to undefined.
 * @utility @ankhorage/utility/object
 */
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
