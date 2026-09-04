/***
 * Escape a value for safe interpolation inside a single-quoted JavaScript or TypeScript string literal.
 * @utility @ankhorage/utility/string
 */
export function escapeStringLiteral(value: string): string {
  return value
    .replaceAll('\\', '\\\\')
    .replaceAll("'", "\\'")
    .replaceAll('\n', '\\n')
    .replaceAll('\r', '\\r');
}
