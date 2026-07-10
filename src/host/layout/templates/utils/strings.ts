export function joinNonEmptyLines(lines: string[]): string {
  return lines.filter((line) => line.length > 0).join('\n');
}

export function toSafeComponentName(value: string): string {
  return value.replace(/[^a-zA-Z0-9]/g, '');
}
