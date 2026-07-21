import { access } from 'node:fs/promises';

const CHROME_CANDIDATES = [
  process.env.CHROME_PATH,
  '/usr/bin/google-chrome',
  '/usr/bin/google-chrome-stable',
  '/usr/bin/chromium',
  '/usr/bin/chromium-browser',
  '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  '/Applications/Chromium.app/Contents/MacOS/Chromium',
].filter(
  (candidate): candidate is string => typeof candidate === 'string' && candidate.length > 0,
);

async function resolveChromePath(): Promise<string> {
  for (const candidate of CHROME_CANDIDATES) {
    try {
      await access(candidate);
      return candidate;
    } catch {
      continue;
    }
  }

  throw new Error(
    'Could not resolve a Chrome or Chromium executable. Set CHROME_PATH or install google-chrome/chromium.',
  );
}

const chromePath = await resolveChromePath();
const subprocess = Bun.spawn({
  cmd: [process.execPath, 'test', 'src/host/generatedAdminExpoWeb.smoke.test.ts'],
  env: {
    ...process.env,
    ANKH_STUDIO_ADMIN_WEB_SMOKE: '1',
    CHROME_PATH: chromePath,
  },
  stdout: 'inherit',
  stderr: 'inherit',
});

process.exit(await subprocess.exited);
