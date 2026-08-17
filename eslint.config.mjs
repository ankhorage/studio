import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { createConfig } from '@ankhorage/devtools/eslint';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const STUDIO_FILES = ['src/**/*.ts', 'scripts/**/*.ts'];

export default createConfig({
  tsconfigRootDir: __dirname,
  project: ['./tsconfig.json'],
  files: STUDIO_FILES,
  overrides: [
    {
      files: STUDIO_FILES,
      rules: {
        'max-lines': [
          'error',
          {
            max: 250,
            skipBlankLines: true,
            skipComments: true,
          },
        ],
        'max-lines-per-function': [
          'error',
          {
            max: 70,
            skipBlankLines: true,
            skipComments: true,
          },
        ],
      },
    },
  ],
});
