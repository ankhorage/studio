/***
 * Create and validate the payload used while dragging a Studio canvas node.
 *
 * Run with `bun examples/canvas-drag-payload/basic.ts` after building the package.
 *
 * @usage
 * @readme
 */
import {
  createStudioCanvasDragPayload,
  isStudioCanvasDragPayload,
} from '@ankhorage/studio/canvasDragModel';

const payload = createStudioCanvasDragPayload('screen-heading');
console.log(isStudioCanvasDragPayload(payload));
