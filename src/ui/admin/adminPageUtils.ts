export function readRecord(value: unknown): Record<string, unknown> {
  return typeof value === 'object' && value !== null ? (value as Record<string, unknown>) : {};
}

export function readString(value: unknown): string | null {
  return typeof value === 'string' ? value : null;
}
