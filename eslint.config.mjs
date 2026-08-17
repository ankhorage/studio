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
        'complexity': [
          'error',
          {
            max: 20
          }
        ],
        'max-lines': [
          'error',
          {
            max: 800,
            skipBlankLines: true,
            skipComments: true,
          },
        ],
        'max-lines-per-function': [
          'error',
          {
            max: 700,
            skipBlankLines: true,
            skipComments: true,
          },
        ],
      },
    },
  ],
});
