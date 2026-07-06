import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { createConfig } from '@ankhorage/devtools/eslint';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export default createConfig({
  tsconfigRootDir: __dirname,
  project: ['./tsconfig.json'],
  files: ['src/**/*.ts', 'scripts/**/*.ts'],
  overrides: [
    {
      files: ['src/dnd/**/*.ts'],
      rules: {
        'no-restricted-imports': [
          'error',
          {
            paths: [
              {
                name: 'react-native-reanimated-dnd',
                message:
                  "Forbidden in Studio. Use '@ankhorage/react-native-reanimated-dnd-web' directly instead.",
              },
            ],
          },
        ],
      },
    },
  ],
});
