export interface TrimmedOutput {
  text: string;
  truncated: boolean;
  originalLength: number;
}

export function trimOutputForApi(text: string, maxChars: number): TrimmedOutput {
  if (maxChars <= 0) {
    return {
      text: '',
      truncated: text.length > 0,
      originalLength: text.length,
    };
  }

  if (text.length <= maxChars) {
    return {
      text,
      truncated: false,
      originalLength: text.length,
    };
  }

  const omitted = text.length - maxChars;
  const marker = `\n...[truncated ${omitted} chars]`;

  if (marker.length >= maxChars) {
    return {
      text: marker.slice(0, maxChars),
      truncated: true,
      originalLength: text.length,
    };
  }

  const keep = maxChars - marker.length;
  return {
    text: `${text.slice(0, keep)}${marker}`,
    truncated: true,
    originalLength: text.length,
  };
}
