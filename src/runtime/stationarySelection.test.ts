import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { describe, expect, it } from 'bun:test';

const stationarySelectionSource = readFileSync(
  join(import.meta.dir, 'stationarySelection.ts'),
  'utf8',
);

describe('stationarySelection', () => {
  it('exports createStationarySelectionCoordinator', () => {
    expect(stationarySelectionSource).toContain(
      'export function createStationarySelectionCoordinator',
    );
  });

  it('exports TransactionState type', () => {
    expect(stationarySelectionSource).toContain('TransactionState');
  });

  it('exports StationarySelectionCoordinator interface', () => {
    expect(stationarySelectionSource).toContain('export interface StationarySelectionCoordinator');
  });

  it('exports StationaryTapSelector', () => {
    expect(stationarySelectionSource).toContain('export { StationaryTapSelector }');
  });

  it('exports createStudioStationarySelectionWrapNode', () => {
    expect(stationarySelectionSource).toContain(
      'export function createStudioStationarySelectionWrapNode',
    );
  });

  it('re-exports stationarySelection from the runtime index', () => {
    const indexSource = readFileSync(join(import.meta.dir, 'index.ts'), 'utf8');
    expect(indexSource).toContain("export * from './stationarySelection.js'");
  });

  it('uses a shared tracker ref via context (no React ref)', () => {
    expect(stationarySelectionSource).toContain('TrackerContext');
    expect(stationarySelectionSource).toContain('trackerRef');
  });

  it('has no module-global mutable tracker', () => {
    const trackerDecl = /const\s+\w+.*MutableRefObject/s.exec(stationarySelectionSource);
    const moduleGlobalTracker = trackerDecl?.find((match) => !match.includes('createContext'));
    expect(moduleGlobalTracker).toBeUndefined();
  });

  it('has root selector own tracker instance via createStationarySelectionCoordinator', () => {
    expect(stationarySelectionSource).toContain('createStationarySelectionCoordinator');
  });

  it('records an ordered node path via push', () => {
    expect(stationarySelectionSource).toContain('.path.push(');
  });

  it('ignores duplicate node participation', () => {
    expect(stationarySelectionSource).toContain('!tx.path.includes(nodeId)');
  });

  it('uses deterministic deepest node wins via destructured path first element', () => {
    expect(stationarySelectionSource).toContain('const [deepestNodeId] = tx.path');
  });

  it('has transaction generation token', () => {
    expect(stationarySelectionSource).toContain('transactionId: Date.now()');
  });

  it('BEGAN clears stale state by beginning a fresh transaction', () => {
    expect(stationarySelectionSource).toContain('State.BEGAN');
    expect(stationarySelectionSource).toContain('beginTransaction');
  });

  it('stationary Edit success commits once via finalized flag', () => {
    expect(stationarySelectionSource).toContain('finalized');
  });

  it('Preview never commits', () => {
    expect(stationarySelectionSource).toContain('if (!isEditMode)');
  });

  it('clears state on movement end', () => {
    expect(stationarySelectionSource).toContain('clearTransaction');
  });

  it('handles failure and cancellation by clearing state', () => {
    expect(stationarySelectionSource).toContain('State.FAILED');
    expect(stationarySelectionSource).toContain('State.CANCELLED');
  });

  it('handles END by clearing state', () => {
    expect(stationarySelectionSource).toContain('State.END');
  });

  it('has mode change clear via useEffect on isEditMode', () => {
    expect(stationarySelectionSource).toContain('[props.isEditMode]');
  });

  it('node-level touch-end does not clear path before root commitment', () => {
    expect(stationarySelectionSource).toContain('onTouchStart');
    expect(stationarySelectionSource).not.toContain('onTouchEnd');
    expect(stationarySelectionSource).not.toContain('onTouchEnd');
  });

  it('has no Pressable recorders', () => {
    expect(stationarySelectionSource).not.toContain('Pressable');
  });

  it('has exactly one root-level GestureHandler import, no per-node recognizer imports', () => {
    const importMatches = stationarySelectionSource.match(/from 'react-native-gesture-handler'/g);
    expect(importMatches?.length).toBe(1);
  });

  it('has no cloneElement', () => {
    expect(stationarySelectionSource).not.toContain('cloneElement');
  });

  it('has no responder stealing', () => {
    expect(stationarySelectionSource).not.toContain('responder');
  });

  it('has no rectangle hit testing', () => {
    expect(stationarySelectionSource).not.toContain('hitTest');
    expect(stationarySelectionSource).not.toContain('measure');
  });

  it('preserves component identity and authored props in wrapNode', () => {
    expect(stationarySelectionSource).toContain('args.rendered');
  });

  it('uses pointerEvents box-none on unsupported node wrapper, not none', () => {
    expect(stationarySelectionSource).toContain("'box-none'");
    expect(stationarySelectionSource).not.toContain("'none'");
  });

  it('thirdPartySupport declaration is Readonly<Record<string, true>>', () => {
    expect(stationarySelectionSource).toContain('Readonly<Record<string, true>>');
  });

  it('thirdPartySupport does not contain mode (enabled/passive)', () => {
    expect(stationarySelectionSource).not.toContain("'enabled'");
    expect(stationarySelectionSource).not.toContain("'passive'");
  });
});
