import type { ScreenSpec } from '@ankhorage/contracts';
import { describe, expect, it } from 'bun:test';

import { getScreenTsx } from './screen';

const screenDef: ScreenSpec = {
  id: 'screen-home',
  name: 'Home',
  root: {
    id: 'screen-root',
    type: 'Screen',
  },
};

describe('getScreenTsx', () => {
  it('keeps generated routes layout-transparent so the authored screen owns scrolling', () => {
    const source = getScreenTsx({ screenId: 'screen-home', screenDef });

    expect(source).not.toContain('ScrollView');
    expect(source).toContain('flex: 1');
    expect(source).toContain('minHeight: 0');
    expect(source).toContain('minWidth: 0');
    expect(source).toContain('<RuntimeScreen');
    expect(source).toContain('Object.values(runtimeManifest.screens).find(');
    expect(source).toContain('StyleSheet.create({');
    expect(source).not.toContain('style={{');
  });
});
