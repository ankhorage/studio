import { describe, expect, it } from 'bun:test';

import { satisfiesCaretSemverRange } from './semverRange';

describe('satisfiesCaretSemverRange', () => {
  it.each([
    ['2.9.0', true],
    ['2.9.1', true],
    ['2.10.0', true],
    ['2.8.9', false],
    ['3.0.0', false],
    ['1.99.0', false],
  ])('evaluates %s against ^2.9.0', (version, expected) => {
    expect(satisfiesCaretSemverRange(version, '^2.9.0')).toBe(expected);
  });
});
