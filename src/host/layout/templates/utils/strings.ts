/***
 * Remove non-alphanumeric characters from a value before using it as a generated component identifier fragment.
 * @utility @ankhorage/utility/string
 */
export function toSafeComponentName(value: string): string {
  return value.replace(/[^a-zA-Z0-9]/g, '');
}
