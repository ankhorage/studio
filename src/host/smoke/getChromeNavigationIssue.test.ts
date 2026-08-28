import { describe, expect, test } from 'bun:test';

import { getChromeNavigationIssue } from './getChromeNavigationIssue';

describe('getChromeNavigationIssue', () => {
  test('captures severe console calls with useful arguments and stack locations', () => {
    const issue = getChromeNavigationIssue('Runtime.consoleAPICalled', {
      type: 'error',
      args: [{ type: 'string', value: 'Hydration failed' }, { description: 'Error: mismatch' }],
      stackTrace: {
        callFrames: [
          {
            functionName: 'hydrateRoot',
            url: 'http://localhost/app.js',
            lineNumber: 8,
            columnNumber: 3,
          },
        ],
      },
    });

    expect(issue).toContain('[console.error]');
    expect(issue).toContain('Hydration failed');
    expect(issue).toContain('Error: mismatch');
    expect(issue).toContain('hydrateRoot (http://localhost/app.js:9:4)');
  });

  test('captures console warnings, assertions, browser logs, and uncaught exceptions', () => {
    expect(
      getChromeNavigationIssue('Runtime.consoleAPICalled', {
        type: 'warning',
        args: [{ value: 'warning detail' }],
      }),
    ).toContain('[console.warning] "warning detail"');
    expect(
      getChromeNavigationIssue('Runtime.consoleAPICalled', {
        type: 'assert',
        args: [{ value: 'assertion detail' }],
      }),
    ).toContain('[console.assert] "assertion detail"');
    expect(
      getChromeNavigationIssue('Log.entryAdded', {
        entry: { level: 'error', source: 'javascript', text: 'script failed' },
      }),
    ).toContain('[javascript error] script failed');
    expect(
      getChromeNavigationIssue('Runtime.exceptionThrown', {
        exceptionDetails: {
          text: 'Uncaught',
          exception: { description: 'Error: exploded' },
          url: 'http://localhost/app.js',
          lineNumber: 4,
          columnNumber: 2,
        },
      }),
    ).toContain('[uncaught exception] Uncaught Error: exploded http://localhost/app.js:5:3');
  });

  test('ignores non-severe console and log events', () => {
    expect(
      getChromeNavigationIssue('Runtime.consoleAPICalled', {
        type: 'log',
        args: [{ value: 'ordinary diagnostic' }],
      }),
    ).toBeNull();
    expect(
      getChromeNavigationIssue('Log.entryAdded', {
        entry: { level: 'info', text: 'ordinary diagnostic' },
      }),
    ).toBeNull();
  });

  test('captures failed asset responses and transport failures', () => {
    expect(
      getChromeNavigationIssue('Network.responseReceived', {
        response: { status: 404, url: 'http://localhost/_expo/static/app.js' },
      }),
    ).toBe('[network response] 404 http://localhost/_expo/static/app.js');
    expect(
      getChromeNavigationIssue('Network.loadingFailed', {
        errorText: 'net::ERR_CONNECTION_REFUSED',
      }),
    ).toBe('[network failure] net::ERR_CONNECTION_REFUSED');
  });

  test('ignores successful responses, favicon absence, and canceled requests', () => {
    expect(
      getChromeNavigationIssue('Network.responseReceived', {
        response: { status: 200, url: 'http://localhost/_expo/static/app.js' },
      }),
    ).toBeNull();
    expect(
      getChromeNavigationIssue('Network.responseReceived', {
        response: { status: 404, url: 'http://localhost/favicon.ico' },
      }),
    ).toBeNull();
    expect(
      getChromeNavigationIssue('Network.loadingFailed', {
        canceled: true,
        errorText: 'net::ERR_ABORTED',
      }),
    ).toBeNull();
  });
});
