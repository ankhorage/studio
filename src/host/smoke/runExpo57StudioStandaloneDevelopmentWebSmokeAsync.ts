import { type ChildProcessWithoutNullStreams, spawn } from 'node:child_process';

import { assertNoBrowserErrors } from './assertNoBrowserErrors';
import { ChromeNavigationSession } from './ChromeNavigationSession';
import { reserveTcpPortAsync } from './reserveTcpPortAsync';

const HTTP_TIMEOUT_MS = 120_000;

export async function runExpo57StudioStandaloneDevelopmentWebSmokeAsync(options: {
  readonly apiUrl: string;
  readonly categoryId: string;
  readonly categoryLabel: string;
  readonly fixtureRoot: string;
  readonly templateId: string;
  readonly templateName: string;
}): Promise<void> {
  const [debugPort, expoPort] = await Promise.all([
    reserveTcpPortAsync('Standalone Studio Chrome'),
    reserveTcpPortAsync('Standalone Studio Expo Web'),
  ]);
  const output: string[] = [];
  const expoProcess = spawn('bun', ['run', 'web', '--', '--port', String(expoPort), '--clear'], {
    cwd: options.fixtureRoot,
    detached: true,
    env: {
      ...process.env,
      BROWSER: 'none',
      CI: '1',
      EXPO_NO_TELEMETRY: '1',
      EXPO_PUBLIC_API_URL: options.apiUrl,
      EXPO_ROUTER_DISABLE_RN_NAVIGATION_CHECK: '1',
    },
  });
  collectOutput(expoProcess, output);
  let browser: ChromeNavigationSession | null = null;
  const appUrl = `http://127.0.0.1:${expoPort}`;

  try {
    await waitForHttpAsync(appUrl, expoProcess, output);
    browser = await ChromeNavigationSession.createAsync(debugPort);
    await browser.navigateAsync(`${appUrl}/`);
    await browser.waitForBodyTextAsync('Release Monitor');
    await browser.clickByRoleAndNameAsync('button', 'New project');
    await browser.waitForLocationAsync({ pathname: '/create' });
    await browser.waitForBodyTextAsync('New Project');

    await browser.navigateAsync(`${appUrl}/create?source=standalone`);
    await browser.waitForLocationAsync({ pathname: '/create', search: '?source=standalone' });
    await browser.clickByRoleAndNameAsync('button', `Browse ${options.categoryLabel} templates`);
    await browser.waitForLocationAsync({ pathname: `/create/${options.categoryId}` });
    await browser.clickByRoleAndNameAsync('button', `Select ${options.templateName}`);
    const templatePath = `/create/${options.categoryId}/${options.templateId}`;
    await browser.waitForLocationAsync({ pathname: templatePath });
    await browser.waitForBodyTextAsync('Project name');

    await browser.goBackAsync();
    await browser.waitForLocationAsync({ pathname: `/create/${options.categoryId}` });
    await browser.goForwardAsync();
    await browser.waitForLocationAsync({ pathname: templatePath });
    await browser.reloadAsync();
    await browser.waitForBodyTextAsync('Project name');

    await browser.navigateAsync(`${appUrl}/projects/release-monitor?view=details`);
    await browser.waitForLocationAsync({
      pathname: '/projects/release-monitor',
      search: '?view=details',
    });
    await browser.waitForBodyTextAsync('Project Detail');
    assertNoBrowserErrors(browser.errors, 'Standalone Studio development Web');
  } finally {
    browser?.close();
    await stopProcessAsync(expoProcess);
  }
}

function collectOutput(processToCollect: ChildProcessWithoutNullStreams, output: string[]): void {
  processToCollect.stdout.on('data', (chunk: Buffer) => output.push(chunk.toString('utf8')));
  processToCollect.stderr.on('data', (chunk: Buffer) => output.push(chunk.toString('utf8')));
}

async function stopProcessAsync(processToStop: ChildProcessWithoutNullStreams): Promise<void> {
  if (!processToStop.pid || processToStop.exitCode !== null) return;
  try {
    process.kill(-processToStop.pid, 'SIGTERM');
  } catch {
    processToStop.kill('SIGTERM');
  }
  await Promise.race([
    new Promise<void>((resolve) => processToStop.once('exit', () => resolve())),
    Bun.sleep(5_000),
  ]);
}

async function waitForHttpAsync(
  url: string,
  processToWatch: ChildProcessWithoutNullStreams,
  output: string[],
): Promise<void> {
  const startedAt = Date.now();
  while (Date.now() - startedAt < HTTP_TIMEOUT_MS) {
    if (processToWatch.exitCode !== null) {
      throw new Error(
        `Standalone Studio Expo Web exited with ${processToWatch.exitCode}.\n${output.join('').slice(-8_000)}`,
      );
    }
    try {
      const response = await fetch(url);
      if (response.status < 500) return;
    } catch {
      await Bun.sleep(250);
    }
  }
  throw new Error(`Timed out waiting for ${url}.\n${output.join('').slice(-8_000)}`);
}
