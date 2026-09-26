/***
 * Escape a value for safe interpolation inside a single-quoted JavaScript or TypeScript string literal.
 * Utility candidate: @ankhorage/utility/string
 */
export function escapeStringLiteral(value: string): string {
  return value
    .replaceAll('\\', '\\\\')
    .replaceAll("'", "\\'")
    .replaceAll('\n', '\\n')
    .replaceAll('\r', '\\r');
}
