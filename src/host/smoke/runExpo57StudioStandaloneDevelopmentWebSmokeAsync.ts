import { type ChildProcessWithoutNullStreams, spawn } from 'node:child_process';

import { assertNoBrowserErrors } from './assertNoBrowserErrors';
import { assertStudioWebIconFontsAsync } from './assertStudioWebIconFontsAsync';
import { ChromeNavigationSession } from './ChromeNavigationSession';
import { reserveTcpPortAsync } from './reserveTcpPortAsync';

const HTTP_TIMEOUT_MS = 120_000;

/***
 * Launch the standalone Studio development Web app and exercise project/category/detail navigation, pointer hit testing, theme toggling, icon fonts and host-backed project deletion in a real browser.
 * @todo Move this development-Web acceptance smoke from production src/host/smoke to test/smoke.
 */
export async function runExpo57StudioStandaloneDevelopmentWebSmokeAsync(options: {
  readonly apiUrl: string;
  readonly categoryId: string;
  readonly categoryLabel: string;
  readonly fixtureRoot: string;
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
    await assertStudioWebIconFontsAsync(browser);
    await pointerClickAsync(browser, 'button', 'Updated');
    await pointerClickAsync(browser, 'button', 'Name');
    await pointerClickAsync(browser, 'button', 'Use light mode');
    await browser.waitForHydratedRoleAndNameAsync('button', 'Use dark mode');

    await pointerClickAsync(browser, 'button', 'New project');
    await browser.waitForLocationAsync({ pathname: '/create' });
    await browser.waitForBodyTextAsync('New Project');
    await pointerClickAsync(browser, 'button', 'Go to projects');
    await browser.waitForLocationAsync({ pathname: '/' });
    await pointerClickAsync(browser, 'button', 'New project');
    await browser.waitForLocationAsync({ pathname: '/create' });
    await pointerClickAsync(browser, 'button', 'Back');
    await browser.waitForLocationAsync({ pathname: '/' });

    await browser.navigateAsync(`${appUrl}/create?source=standalone`);
    await browser.waitForLocationAsync({ pathname: '/create', search: '?source=standalone' });
    await pointerClickAsync(browser, 'button', `Browse ${options.categoryLabel} templates`);
    await browser.waitForLocationAsync({ pathname: `/create/${options.categoryId}` });
    await browser.waitForBodyTextAsync('No templates in this category');
    await pointerClickAsync(browser, 'button', 'Back to categories');
    await browser.waitForLocationAsync({ pathname: '/create' });

    await browser.navigateAsync(`${appUrl}/`);
    await browser.waitForBodyTextAsync('Release Monitor');
    await pointerClickAsync(browser, 'button', 'Open Release Monitor');
    await browser.waitForLocationAsync({
      pathname: '/projects/release-monitor',
      search: '',
    });
    await browser.waitForBodyTextAsync('Project Detail');
    await pointerClickAsync(browser, 'button', 'Install packages');
    await browser.waitForBodyTextAsync('Project packages installed.');

    await browser.navigateAsync(`${appUrl}/projects/release-monitor?view=details`);
    await browser.waitForLocationAsync({
      pathname: '/projects/release-monitor',
      search: '?view=details',
    });
    await browser.waitForBodyTextAsync('Project Detail');

    await deleteHostProjectAsync(options.apiUrl, 'release-monitor');
    await browser.navigateAsync(`${appUrl}/`);
    await browser.waitForBodyTextAsync('No projects yet');
    await assertStudioWebIconFontsAsync(browser);
    await pointerClickAsync(browser, 'button', 'New project');
    await browser.waitForLocationAsync({ pathname: '/create' });
    await pointerClickAsync(browser, 'button', 'Back');
    await browser.waitForLocationAsync({ pathname: '/' });
    await browser.waitForBodyTextAsync('No projects yet');
    await pointerClickAsync(browser, 'button', 'New project', 1);
    await browser.waitForLocationAsync({ pathname: '/create' });
    assertNoBrowserErrors(browser.errors, 'Standalone Studio development Web');
  } finally {
    browser?.close();
    await stopProcessAsync(expoProcess);
  }
}

/***
 * Collect UTF-8 stdout and stderr chunks from a child process into a shared output buffer.
 * @utility @ankhorage/utility/node/process
 */
function collectOutput(processToCollect: ChildProcessWithoutNullStreams, output: string[]): void {
  processToCollect.stdout.on('data', (chunk: Buffer) => output.push(chunk.toString('utf8')));
  processToCollect.stderr.on('data', (chunk: Buffer) => output.push(chunk.toString('utf8')));
}

/*** Delete one host fixture project through the standalone Studio HTTP API. */
async function deleteHostProjectAsync(apiUrl: string, projectId: string): Promise<void> {
  const response = await fetch(`${apiUrl}/projects/${encodeURIComponent(projectId)}`, {
    method: 'DELETE',
  });
  if (!response.ok) {
    throw new Error(`Could not delete standalone host fixture project: ${response.status}.`);
  }
}

/*** Wait for an accessible browser control to hydrate and then dispatch a real pointer click through the Chrome session. */
async function pointerClickAsync(
  browser: ChromeNavigationSession,
  role: string,
  name: string,
  occurrence = 0,
): Promise<void> {
  await browser.waitForHydratedRoleAndNameAsync(role, name, occurrence);
  await browser.clickByRoleAndNameAsync(role, name, occurrence);
}

/***
 * Terminate a detached child-process group and wait briefly for exit without hanging the caller.
 * @utility @ankhorage/utility/node/process
 */
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

/***
 * Poll an HTTP URL while supervising its child process, including recent process output in failures.
 * @utility @ankhorage/utility/http
 */
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
