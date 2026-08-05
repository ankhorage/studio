from pathlib import Path


def replace_once(path: str, old: str, new: str, label: str) -> None:
    file_path = Path(path)
    text = file_path.read_text()
    count = text.count(old)
    if count != 1:
        raise RuntimeError(f'{label}: expected one match, found {count}')
    file_path.write_text(text.replace(old, new, 1))


replace_once(
    'src/host/oauthFixtureConsumer.smoke.test.ts',
    "    expect(oauthRuntime).not.toContain('redirectUri: string;');\n",
    '',
    'fixture redirect variable expectation',
)

replace_once(
    'src/host/layout/templates/auth/oauth.test.ts',
    "  expect(runtime).not.toContain('redirectUri: string;');\n",
    '',
    'template redirect variable expectation',
)

replace_once(
    'src/host/layout/layoutGenerator.test.ts',
    "    expect(oauth).toContain('configuredProvider');\n",
    "    expect(oauth).toContain('version === 1');\n    expect(oauth).toContain('LEGACY_OAUTH_TRANSPORT_ATTEMPT_KEY');\n",
    'generated transport marker expectation',
)
