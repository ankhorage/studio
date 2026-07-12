export const RAW_SECRET_RESPONSE_KEYS = [
  'clientSecret',
  'payload',
  'privateKey',
  'rawValue',
  'secret',
  'token',
  'value',
] as const;

const RAW_SECRET_RESPONSE_KEY_SET = new Set<string>(RAW_SECRET_RESPONSE_KEYS);

export interface RawSecretResponseKeyMatch {
  readonly path: string;
  readonly key: string;
}

export function findRawSecretResponseKey(value: unknown): RawSecretResponseKeyMatch | null {
  return findRawSecretResponseKeyAtPath(value, '$', new Set<object>());
}

export function assertMetadataOnlyResponse(value: unknown, message: string): void {
  const match = findRawSecretResponseKey(value);
  if (match) {
    throw new Error(`${message} Raw secret-shaped response field "${match.key}" at ${match.path}.`);
  }
}

function findRawSecretResponseKeyAtPath(
  value: unknown,
  path: string,
  seen: Set<object>,
): RawSecretResponseKeyMatch | null {
  if (typeof value !== 'object' || value === null) {
    return null;
  }

  if (seen.has(value)) {
    return null;
  }
  seen.add(value);

  if (Array.isArray(value)) {
    for (let index = 0; index < value.length; index += 1) {
      const match = findRawSecretResponseKeyAtPath(value[index], `${path}[${index}]`, seen);
      if (match) return match;
    }
    return null;
  }

  for (const [key, nestedValue] of Object.entries(value as Record<string, unknown>)) {
    if (RAW_SECRET_RESPONSE_KEY_SET.has(key)) {
      return { path: `${path}.${key}`, key };
    }

    const match = findRawSecretResponseKeyAtPath(nestedValue, `${path}.${key}`, seen);
    if (match) return match;
  }

  return null;
}
