export interface NativeElementRect {
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly height: number;
}

export interface NativeElementLike {
  readonly children: ArrayLike<NativeElementLike>;
  readonly isConnected: boolean;
  readonly ownerDocument: object | null;
  readonly parentElement: NativeElementLike | null;
  readonly tagName: string;
  getBoundingClientRect(): NativeElementRect;
}

const NATIVE_SCROLL_VIEW_TAGS = new Set(['RN:AndroidHorizontalScrollView', 'RN:RCTScrollView']);

/*** Return whether a measured rectangle is finite and has a visible area. */
function isVisibleNativeElementRect(rect: NativeElementRect): boolean {
  return (
    Number.isFinite(rect.x) &&
    Number.isFinite(rect.y) &&
    Number.isFinite(rect.width) &&
    Number.isFinite(rect.height) &&
    rect.width > 0 &&
    rect.height > 0
  );
}

/*** Intersect two native viewport rectangles, returning null when they do not overlap. */
export function intersectNativeElementRects(
  rect: NativeElementRect,
  clipRect: NativeElementRect,
): NativeElementRect | null {
  const left = Math.max(rect.x, clipRect.x);
  const top = Math.max(rect.y, clipRect.y);
  const right = Math.min(rect.x + rect.width, clipRect.x + clipRect.width);
  const bottom = Math.min(rect.y + rect.height, clipRect.y + clipRect.height);

  return right > left && bottom > top
    ? { x: left, y: top, width: right - left, height: bottom - top }
    : null;
}

/*** Return whether a public native element is a scroll viewport that can clip descendants. */
function isNativeScrollViewport(element: NativeElementLike): boolean {
  return NATIVE_SCROLL_VIEW_TAGS.has(element.tagName);
}

/*** Clip a rendered host rectangle to every connected native scroll viewport above it. */
function clipToNativeScrollViewports(
  element: NativeElementLike,
  rect: NativeElementRect,
  ownerDocument: object | null,
): NativeElementRect | null {
  let clippedRect: NativeElementRect | null = rect;
  let parent = element.parentElement;

  while (clippedRect && parent) {
    if (!parent.isConnected || parent.ownerDocument !== ownerDocument) {
      return null;
    }
    if (isNativeScrollViewport(parent)) {
      const parentRect = parent.getBoundingClientRect();
      if (!isVisibleNativeElementRect(parentRect)) {
        return null;
      }
      clippedRect = intersectNativeElementRects(clippedRect, parentRect);
    }
    parent = parent.parentElement;
  }

  return clippedRect;
}

/*** Find the first positive-area authored host on each branch beneath a layout-neutral recorder. */
function collectFirstRenderedNativeHosts(
  element: NativeElementLike,
  ownerDocument: object | null,
): readonly { readonly element: NativeElementLike; readonly rect: NativeElementRect }[] {
  if (!element.isConnected || element.ownerDocument !== ownerDocument) {
    return [];
  }

  const rect = element.getBoundingClientRect();
  if (isVisibleNativeElementRect(rect)) {
    return [{ element, rect }];
  }

  return Array.from(element.children).flatMap((child) =>
    collectFirstRenderedNativeHosts(child, ownerDocument),
  );
}

/*** Compute the smallest rectangle containing every supplied native rectangle. */
function unionNativeElementRects(rects: readonly NativeElementRect[]): NativeElementRect | null {
  if (rects.length === 0) {
    return null;
  }

  const left = Math.min(...rects.map((rect) => rect.x));
  const top = Math.min(...rects.map((rect) => rect.y));
  const right = Math.max(...rects.map((rect) => rect.x + rect.width));
  const bottom = Math.max(...rects.map((rect) => rect.y + rect.height));
  return { x: left, y: top, width: right - left, height: bottom - top };
}

/*** Measure one connected native element directly in viewport coordinates. */
export function measureNativeElement(element: NativeElementLike): NativeElementRect | null {
  if (!element.isConnected) {
    return null;
  }

  const rect = element.getBoundingClientRect();
  return isVisibleNativeElementRect(rect) ? rect : null;
}

/*** Measure the authored native hosts beneath a layout-neutral Runtime node recorder. */
export function measureNativeRuntimeNodeElement(
  recorder: NativeElementLike,
): NativeElementRect | null {
  if (!recorder.isConnected) {
    return null;
  }

  const { ownerDocument } = recorder;
  const hosts = Array.from(recorder.children).flatMap((child) =>
    collectFirstRenderedNativeHosts(child, ownerDocument),
  );
  const visibleRects = hosts.flatMap(({ element, rect }) => {
    const clippedRect = clipToNativeScrollViewports(element, rect, ownerDocument);
    return clippedRect ? [clippedRect] : [];
  });

  return unionNativeElementRects(visibleRects);
}
