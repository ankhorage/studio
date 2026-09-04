/***
 * Join only non-empty lines with a newline delimiter.
 * @utility @ankhorage/utility/string
 */
export function joinNonEmptyLines(lines: string[]): string {
  return lines.filter((line) => line.length > 0).join('\n');
}

/***
 * Remove non-alphanumeric characters from a value before using it as a generated component identifier fragment.
 * @utility @ankhorage/utility/string
 */
export function toSafeComponentName(value: string): string {
  return value.replace(/[^a-zA-Z0-9]/g, '');
}
