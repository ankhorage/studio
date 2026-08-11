from pathlib import Path

root = Path('src/host/layout/templates/rootLayout.ts')
text = root.read_text()

old_import = "        { imported: 'ReactNode', typeOnly: true },\n"
new_import = "        { imported: 'Children' },\n        { imported: 'ReactNode', typeOnly: true },\n"
if text.count(old_import) != 1:
    raise SystemExit(f'expected one ReactNode import requirement, found {text.count(old_import)}')
text = text.replace(old_import, new_import, 1)

old_actions = """      actions={
        <>
          <ThemeModeToggle />
          {actions}
        </>
      }
"""
new_actions = """      actions={[
        <ThemeModeToggle key=\"theme-mode\" />,
        ...Children.toArray(actions),
      ]}
"""
if text.count(old_actions) != 1:
    raise SystemExit(f'expected one generated AppBar fragment, found {text.count(old_actions)}')
root.write_text(text.replace(old_actions, new_actions, 1))

test = Path('src/host/layout/templates/rootLayout.test.ts')
test_text = test.read_text()
anchor = "  expect(generated).toContain('actions={studioAppBar.actions}');\n"
replacement = anchor + "  expect(generated).toContain('...Children.toArray(actions)');\n"
if test_text.count(anchor) != 1:
    raise SystemExit(f'expected one Studio AppBar assertion anchor, found {test_text.count(anchor)}')
test.write_text(test_text.replace(anchor, replacement, 1))
