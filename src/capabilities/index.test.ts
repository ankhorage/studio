import { readFileSync } from 'node:fs';

import { areCapabilitiesEqual, isCapability } from '@ankhorage/capability';
import { expect, test } from 'bun:test';

import { CAPABILITIES } from './index';

test('publishes valid unique Studio-owned capability descriptors', () => {
  expect(CAPABILITIES.every(isCapability)).toBeTrue();
  expect(new Set(CAPABILITIES.map(({ id }) => id)).size).toBe(CAPABILITIES.length);
});

test('keeps materialized package metadata equal to the public catalog', () => {
  const parsed: unknown = JSON.parse(
    readFileSync(new URL('../../package.json', import.meta.url), 'utf8'),
  );
  if (!isRecord(parsed)) throw new Error('package.json must contain a JSON object.');
  if (!isRecord(parsed.exports)) throw new Error('package.json exports must be an object.');
  expect(parsed.exports['./capabilities']).toEqual({
    types: './dist/capabilities/index.d.ts',
    import: './dist/capabilities/index.js',
  });
  if (!isRecord(parsed.ankh)) throw new Error('package.json ankh metadata must be an object.');
  const publishedCapabilities = parsed.ankh.capabilities;
  if (!isUnknownArray(publishedCapabilities)) {
    throw new Error('package.json ankh.capabilities must be an array.');
  }

  expect(publishedCapabilities).toHaveLength(CAPABILITIES.length);
  for (const [index, capability] of CAPABILITIES.entries()) {
    const published = publishedCapabilities.at(index);
    expect(isCapability(published)).toBeTrue();
    if (!isCapability(published)) continue;
    expect(areCapabilitiesEqual(published, capability)).toBeTrue();
  }
});

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isUnknownArray(value: unknown): value is readonly unknown[] {
  return Array.isArray(value);
}
