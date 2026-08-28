import { assertNoBrowserErrors } from './assertNoBrowserErrors';
import { assertStudioWebIconFontsAsync } from './assertStudioWebIconFontsAsync';
import { ChromeNavigationSession } from './ChromeNavigationSession';
import { createStaticExportServer } from './createStaticExportServer';
import { reserveTcpPortAsync } from './reserveTcpPortAsync';

export async function runExpo57StudioStandaloneStaticWebSmokeAsync(
  fixtureRoot: string,
): Promise<void> {
  const server = createStaticExportServer(fixtureRoot);
  let browser: ChromeNavigationSession | null = null;
  try {
    if (server.port === undefined) throw new Error('Static Studio server has no TCP port.');
    browser = await ChromeNavigationSession.createAsync(
      await reserveTcpPortAsync('Standalone Studio static Chrome'),
    );
    const appUrl = `http://127.0.0.1:${server.port}`;
    await browser.navigateAsync(`${appUrl}/`);
    await browser.waitForBodyTextAsync('No projects yet');
    await assertStudioWebIconFontsAsync(browser);
    await browser.waitForHydratedRoleAndNameAsync('button', 'New project');
    await browser.clickByRoleAndNameAsync('button', 'New project');
    await browser.waitForLocationAsync({ pathname: '/create' });
    await browser.waitForBodyTextAsync('New Project');
    await browser.waitForHydratedRoleAndNameAsync('button', 'Back');
    await browser.clickByRoleAndNameAsync('button', 'Back');
    await browser.waitForLocationAsync({ pathname: '/' });
    await browser.waitForBodyTextAsync('No projects yet');
    await browser.waitForHydratedRoleAndNameAsync('button', 'New project', 1);
    await browser.clickByRoleAndNameAsync('button', 'New project', 1);
    await browser.waitForLocationAsync({ pathname: '/create' });
    assertNoBrowserErrors(browser.errors, 'Standalone Studio static Web');
  } finally {
    browser?.close();
    await server.stop(true);
  }
}
