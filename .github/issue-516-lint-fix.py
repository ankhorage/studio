from pathlib import Path

path = Path('src/host/hostLifecycle.smoke.test.ts')
source = path.read_text(encoding='utf-8')
old = """  expect(
    JSON.parse(await readFile(path.join(created.path, '.ankh/generation-state.json'), 'utf8')),
  ).toMatchObject({
    includeStudio: true,
    runtimeProjection: { appliedSignature: expect.any(String) },
  });
"""
new = """  const generationStateSource = await readFile(
    path.join(created.path, '.ankh/generation-state.json'),
    'utf8',
  );
  expect(generationStateSource).toContain('\\\"includeStudio\\\": true');
  expect(generationStateSource).toContain('\\\"appliedSignature\\\": \\\"');
"""
if old not in source:
    raise RuntimeError('Expected generated-state smoke assertion was not found')
path.write_text(source.replace(old, new, 1), encoding='utf-8')
