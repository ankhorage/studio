import { readFile } from 'node:fs/promises';

const readme = await readFile(new URL('../README.md', import.meta.url), 'utf8');

const requiredPhrases = [
  '@ankhorage/studio owns Studio authoring',
  '@ankhorage/runtime',
  '@ankhorage/expo-runtime',
  '@ankhorage/templates',
  '@ankhorage/ankh',
  'This package must not own',
  'generic runtime renderer behavior',
  'Expo package, native config, provider, or adapter planning',
  'template catalog content',
] as const;

const missingPhrases = requiredPhrases.filter((phrase) => !readme.includes(phrase));

if (missingPhrases.length > 0) {
  throw new Error(`README.md is missing required boundary docs: ${missingPhrases.join(', ')}`);
}

console.log('Docs check passed.');
