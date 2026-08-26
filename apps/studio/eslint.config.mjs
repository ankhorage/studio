import { createConfig } from '@ankhorage/devtools/eslint';

export default createConfig({
  files: ['app.config.ts', 'src/**/*.{ts,tsx}'],
  project: ['./tsconfig.json'],
  tsconfigRootDir: import.meta.dirname,
});
