import { describe, expect, it } from 'bun:test';

import {
  intersectNativeElementRects,
  measureNativeElement,
  measureNativeRuntimeNodeElement,
  type NativeElementLike,
  type NativeElementRect,
} from './nativeElementMeasurement';

const documentOwner = {};

function createElement(options?: {
  readonly children?: readonly NativeElementLike[];
  readonly connected?: boolean;
  readonly ownerDocument?: object | null;
  readonly parent?: NativeElementLike | null;
  readonly rect?: NativeElementRect;
  readonly tagName?: string;
}): NativeElementLike {
  const rect = options?.rect ?? { x: 0, y: 0, width: 0, height: 0 };
  return {
    children: options?.children ?? [],
    getBoundingClientRect: () => rect,
    isConnected: options?.connected ?? true,
    ownerDocument: options?.ownerDocument === undefined ? documentOwner : options.ownerDocument,
    parentElement: options?.parent ?? null,
    tagName: options?.tagName ?? 'RN:View',
  };
}

describe('native element measurement', () => {
  it('rejects disconnected, zero-area, and non-finite direct geometry', () => {
    expect(measureNativeElement(createElement({ connected: false }))).toBeNull();
    expect(measureNativeElement(createElement())).toBeNull();
    expect(
      measureNativeElement(
        createElement({ rect: { x: Number.NaN, y: 10, width: 40, height: 20 } }),
      ),
    ).toBeNull();
  });

  it('uses the first positive-area host beneath each recorder branch', () => {
    const nestedHost = createElement({ rect: { x: 15, y: 20, width: 40, height: 30 } });
    const zeroAreaIntermediate = createElement({ children: [nestedHost] });
    const siblingHost = createElement({ rect: { x: 70, y: 25, width: 20, height: 10 } });
    const recorder = createElement({ children: [zeroAreaIntermediate, siblingHost] });

    expect(measureNativeRuntimeNodeElement(recorder)).toEqual({
      x: 15,
      y: 20,
      width: 75,
      height: 30,
    });
  });

  it('stops at the authored outer host instead of expanding to descendants', () => {
    const inner = createElement({ rect: { x: 0, y: 0, width: 300, height: 300 } });
    const outer = createElement({
      children: [inner],
      rect: { x: 20, y: 30, width: 100, height: 80 },
    });

    expect(measureNativeRuntimeNodeElement(createElement({ children: [outer] }))).toEqual({
      x: 20,
      y: 30,
      width: 100,
      height: 80,
    });
  });

  it('rejects hosts from a disconnected or unrelated document branch', () => {
    const unrelated = createElement({
      ownerDocument: {},
      rect: { x: 10, y: 10, width: 20, height: 20 },
    });
    const disconnected = createElement({
      connected: false,
      rect: { x: 30, y: 30, width: 20, height: 20 },
    });

    expect(
      measureNativeRuntimeNodeElement(createElement({ children: [unrelated, disconnected] })),
    ).toBeNull();
  });

  it('clips a host to nested native scroll viewports', () => {
    const outerScroll = createElement({
      rect: { x: 0, y: 0, width: 100, height: 100 },
      tagName: 'RN:RCTScrollView',
    });
    const innerScroll = createElement({
      parent: outerScroll,
      rect: { x: 10, y: 20, width: 80, height: 60 },
      tagName: 'RN:AndroidHorizontalScrollView',
    });
    const host = createElement({
      parent: innerScroll,
      rect: { x: -20, y: 50, width: 150, height: 80 },
    });

    expect(measureNativeRuntimeNodeElement(createElement({ children: [host] }))).toEqual({
      x: 10,
      y: 50,
      width: 80,
      height: 30,
    });
  });

  it('returns no chrome for a host fully clipped by a scroll viewport', () => {
    const scroll = createElement({
      rect: { x: 0, y: 0, width: 100, height: 100 },
      tagName: 'RN:RCTScrollView',
    });
    const host = createElement({
      parent: scroll,
      rect: { x: 0, y: 140, width: 50, height: 20 },
    });

    expect(measureNativeRuntimeNodeElement(createElement({ children: [host] }))).toBeNull();
  });

  it('intersects rectangles at their visible edges', () => {
    expect(
      intersectNativeElementRects(
        { x: -10, y: 20, width: 30, height: 40 },
        { x: 0, y: 0, width: 100, height: 50 },
      ),
    ).toEqual({ x: 0, y: 20, width: 20, height: 30 });
  });
});
