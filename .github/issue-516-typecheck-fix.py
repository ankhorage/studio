from pathlib import Path

path = Path('src/host/orchestrator/projectManagerCurrentState.test.ts')
source = path.read_text(encoding='utf-8')
old = "navigator: { ...manifest.navigator, type: 'tabs' },"
new = "navigator: { type: 'tabs', implementation: 'native', routes: [] },"
if source.count(old) != 2:
    raise RuntimeError(f'Expected exactly two runtime navigator fixtures, found {source.count(old)}')
path.write_text(source.replace(old, new), encoding='utf-8')
