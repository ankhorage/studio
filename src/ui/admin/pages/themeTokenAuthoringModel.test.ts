import { describe, expect, test } from 'bun:test';

import {
  updateNumericThemeToken,
  updateTypographyHeading,
  updateTypographySize,
  updateTypographyWeight,
} from './themeTokenAuthoringModel';

describe('themeTokenAuthoringModel', () => {
  test('adds and resets numeric overrides without copying defaults', () => {
    const authored = updateNumericThemeToken({
      tokens: { shadows: { soft: 3 } },
      family: 'spacing',
      key: 'm',
      value: 18,
    });

    expect(authored).toEqual({ spacing: { m: 18 }, shadows: { soft: 3 } });
    expect(
      updateNumericThemeToken({ tokens: authored, family: 'spacing', key: 'm', value: undefined }),
    ).toEqual({ shadows: { soft: 3 } });
  });

  test('removes the tokens source when its final override is reset', () => {
    expect(
      updateNumericThemeToken({
        tokens: { radii: { card: 12 } },
        family: 'radii',
        key: 'card',
        value: undefined,
      }),
    ).toBeUndefined();
  });

  test('updates free typography sizes while retaining sibling typography source', () => {
    const tokens = updateTypographySize({
      tokens: { typography: { weights: { bold: '800' } } },
      key: 'display',
      value: 42,
    });

    expect(tokens).toEqual({
      typography: { sizes: { display: 42 }, weights: { bold: '800' } },
    });
  });

  test('updates canonical semantic weight slots', () => {
    expect(
      updateTypographyWeight({
        tokens: undefined,
        key: 'semiBold',
        value: '700',
      }),
    ).toEqual({ typography: { weights: { semiBold: '700' } } });
  });

  test('resets one heading field without losing its other authored fields', () => {
    const tokens = {
      typography: {
        headings: {
          '2': { size: 26, lineHeight: 34, weight: 'bold' },
        },
      },
    } as const;

    expect(
      updateTypographyHeading({
        tokens,
        level: '2',
        field: 'size',
        value: undefined,
      }),
    ).toEqual({
      typography: {
        headings: { '2': { lineHeight: 34, weight: 'bold' } },
      },
    });
  });
});
