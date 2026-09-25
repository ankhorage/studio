import type { ThemeRecipeFieldOverrides, ThemeRecipeOverrides } from '@ankhorage/contracts';
import { deleteOwnProperty, readOwnProperty, setOwnProperty } from '@ankhorage/utility/object';

export type ThemeRecipeAuthoringKind = 'component' | 'pattern';

/***
 * Replace one component/pattern recipe override object and prune empty recipe/bucket structures.
 */
export function updateThemeRecipeOverrides(args: {
  readonly recipes: ThemeRecipeOverrides | undefined;
  readonly kind: ThemeRecipeAuthoringKind;
  readonly recipeName: string;
  readonly fields: ThemeRecipeFieldOverrides | undefined;
}): ThemeRecipeOverrides | undefined {
  const bucketName = args.kind === 'component' ? 'components' : 'patterns';
  const bucket = args.recipes
    ? readOwnProperty<Readonly<Record<string, ThemeRecipeFieldOverrides>>>(args.recipes, bucketName)
    : undefined;
  const fields = args.fields && Object.keys(args.fields).length > 0 ? args.fields : undefined;
  const nextBucket = updateRecord(bucket, args.recipeName, fields);
  const nextRecipes: ThemeRecipeOverrides = { ...args.recipes };
  if (nextBucket) setOwnProperty(nextRecipes, bucketName, nextBucket);
  else deleteOwnProperty(nextRecipes, bucketName);
  return nextRecipes.components || nextRecipes.patterns ? nextRecipes : undefined;
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
