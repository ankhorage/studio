export interface TrimmedOutput {
  text: string;
  truncated: boolean;
  originalLength: number;
}

/***
 * Limit text to a maximum character count while preserving original length and appending a truncation marker when space permits.
 * @utility @ankhorage/utility/string
 */
export function trimOutputForApi(text: string, maxChars: number): TrimmedOutput {
  return trimOutput(text, maxChars);
}
import { trimOutput } from '@ankhorage/utility/string';
