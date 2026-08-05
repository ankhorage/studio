from pathlib import Path

path = Path('src/host/generatedOAuthLifecycle.e2e.test.ts')
text = path.read_text()

old_import = "import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';"
new_import = "import { mkdir, mkdtemp, rm, symlink, writeFile } from 'node:fs/promises';"
if text.count(old_import) != 1:
    raise RuntimeError('expected one fs/promises import to update')
text = text.replace(old_import, new_import, 1)

old_root = """  const root = await mkdtemp(path.join(tmpdir(), 'ankh-generated-oauth-lifecycle-'));
  temporaryRoots.add(root);

  await writeFile(
"""
new_root = """  const root = await mkdtemp(path.join(tmpdir(), 'ankh-generated-oauth-lifecycle-'));
  temporaryRoots.add(root);
  await symlink(path.join(process.cwd(), 'node_modules'), path.join(root, 'node_modules'), 'dir');

  await writeFile(
"""
if text.count(old_root) != 1:
    raise RuntimeError('expected one harness root setup to update')
text = text.replace(old_root, new_root, 1)

path.write_text(text)
