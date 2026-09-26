import { quoteJavaScriptString } from '@ankhorage/utility/string';

/***
 * Escape a value for safe interpolation inside a single-quoted JavaScript or TypeScript string literal.
 */
export function escapeStringLiteral(value: string): string {
  return quoteJavaScriptString(value).slice(1, -1);
}
