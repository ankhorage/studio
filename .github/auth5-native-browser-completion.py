from pathlib import Path


def replace_once(text: str, old: str, new: str, label: str) -> str:
    if old not in text:
        raise SystemExit(f'{label} anchor not found')
    return text.replace(old, new, 1)


oauth = Path('src/host/layout/templates/auth/oauth.ts')
text = oauth.read_text()
text = replace_once(
    text,
    "} from '@ankhorage/contracts/auth';\nimport * as Linking from 'expo-linking';",
    "} from '@ankhorage/contracts/auth';\n"
    "import {\n"
    "  resolveExpoOAuthBrowserException,\n"
    "  resolveExpoOAuthBrowserResult,\n"
    "} from '@ankhorage/expo-runtime/oauth-browser';\n"
    "import * as Linking from 'expo-linking';",
    'OAuth import',
)
start_marker = '  let browserResult: WebBrowser.WebBrowserAuthSessionResult;'
end_marker = '  return toTransportOutcome(completed);'
start = text.find(start_marker)
if start < 0:
    raise SystemExit('Native OAuth transport start anchor not found')
end = text.find(end_marker, start)
if end < 0:
    raise SystemExit('Native OAuth transport end anchor not found')
end += len(end_marker)
new_transport = """  let browserResponse;
  try {
    const browserResult = await WebBrowser.openAuthSessionAsync(
      started.data.authorizationUrl,
      started.data.redirectUri,
    );
    browserResponse = resolveExpoOAuthBrowserResult(browserResult);
  } catch {
    browserResponse = resolveExpoOAuthBrowserException();
  }

  if (browserResponse.type === 'callback') {
    return completeOAuthCallback(browserResponse.url);
  }

  let completed: AuthOAuthCompletionResult;
  try {
    completed = await oauth.completeAuthorization({
      attemptId: started.data.attemptId,
      response: browserResponse,
    });
  } catch {
    await clearTransportAttempt();
    return {
      status: 'error',
      message: 'The OAuth browser result could not be completed.',
      recoverable: true,
    };
  }
  await clearTransportAttempt();
  return toTransportOutcome(completed);"""
oauth.write_text(text[:start] + new_transport + text[end:])

templates = Path('src/host/orchestrator/templates.ts')
text = templates.read_text()
templates.write_text(
    replace_once(
        text,
        "const EXPO_RUNTIME_VERSION = '^2.2.1';",
        "const EXPO_RUNTIME_VERSION = '^2.4.0';",
        'Generated Expo Runtime version',
    )
)

test = Path('src/host/layout/templates/auth/oauth.test.ts')
text = test.read_text()
new_expect = '\n'.join(
    [
        "  expect(runtime).toContain(\"from '@ankhorage/expo-runtime/oauth-browser';\");",
        "  expect(runtime).toContain('browserResponse = resolveExpoOAuthBrowserResult(browserResult);');",
        "  expect(runtime).toContain('browserResponse = resolveExpoOAuthBrowserException();');",
        "  expect(runtime).toContain('response: browserResponse');",
        "  expect(runtime).not.toContain(\"browserResult.type === 'dismiss'\");",
    ]
)
test.write_text(
    replace_once(
        text,
        "  expect(runtime).toContain('return completeOAuthCallback(browserResult.url);');",
        new_expect,
        'OAuth template test',
    )
)
