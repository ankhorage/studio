import { readFile, writeFile } from 'node:fs/promises';

import { isRecord } from '@ankhorage/utility/object';

const PACKAGE_PATH = new URL('../package.json', import.meta.url);
const DESCRIPTOR_PATH = new URL('../apm/update.json', import.meta.url);

/*** Synchronize the static APM descriptor owner identity with the exact package version being released. */
export async function syncApmUpdateDescriptorAsync(): Promise<void> {
  const packageJson = parseRecord(await readFile(PACKAGE_PATH, 'utf8'), 'package.json');
  const descriptor = parseRecord(await readFile(DESCRIPTOR_PATH, 'utf8'), 'apm/update.json');
  const { name, version } = packageJson;
  if (typeof version !== 'string' || typeof name !== 'string') {
    throw new Error('package.json must define string name and version fields.');
  }
  const owner = isRecord(descriptor.owner) ? descriptor.owner : {};
  const synchronized = {
    ...descriptor,
    owner: { ...owner, name, version },
  };
  await writeFile(DESCRIPTOR_PATH, `${JSON.stringify(synchronized, null, 2)}\n`, 'utf8');
}

/*** Parse one JSON document as a plain object. */
function parseRecord(source: string, label: string): Readonly<Record<string, unknown>> {
  const value: unknown = JSON.parse(source);
  if (!isRecord(value)) throw new Error(`${label} must contain an object.`);
  return value;
}

await syncApmUpdateDescriptorAsync();
