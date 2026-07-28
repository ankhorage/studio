import { describe, expect, it } from 'bun:test';

import { createStationarySelectionCoordinator } from './stationarySelection';

describe('stationarySelection coordinator', () => {
  it('fresh begin creates generation 1', () => {
    const coordinator = createStationarySelectionCoordinator();
    const generation = coordinator.beginTransaction();

    expect(typeof generation).toBe('number');
    expect(generation).toBe(1);
    const tx = coordinator.getTransaction();
    expect(tx).not.toBeNull();
    expect(tx?.transactionId).toBe(generation);
  });

  it('next begin creates a greater generation', () => {
    const coordinator = createStationarySelectionCoordinator();
    const generation1 = coordinator.beginTransaction();
    coordinator.clearTransaction();
    const generation2 = coordinator.beginTransaction();

    expect(generation2).toBeGreaterThan(generation1);
  });

  it('stale generation record is ignored after clear', () => {
    const coordinator = createStationarySelectionCoordinator();
    const gen1 = coordinator.beginTransaction();
    coordinator.recordNode('node-a');
    coordinator.clearTransaction();

    coordinator.beginTransaction();
    const tx = coordinator.getTransaction();
    expect(tx?.transactionId).not.toBe(gen1);
    expect(tx?.path).toEqual([]);
  });

  it('recordNode adds node to the active transaction path', () => {
    const coordinator = createStationarySelectionCoordinator();
    coordinator.beginTransaction();
    coordinator.recordNode('node-a');

    const tx = coordinator.getTransaction();
    expect(tx?.path).toContain('node-a');
    expect(tx?.path).toEqual(['node-a']);
  });

  it('nested path records outer-to-inner ordering', () => {
    const coordinator = createStationarySelectionCoordinator();
    coordinator.beginTransaction();
    coordinator.recordNode('outer');
    coordinator.recordNode('inner');

    const tx = coordinator.getTransaction();
    expect(tx?.path).toEqual(['outer', 'inner']);
  });

  it('duplicate node IDs are ignored', () => {
    const coordinator = createStationarySelectionCoordinator();
    coordinator.beginTransaction();
    coordinator.recordNode('node-a');
    coordinator.recordNode('node-a');

    const tx = coordinator.getTransaction();
    expect(tx?.path).toEqual(['node-a']);
    expect(tx?.path.length).toBe(1);
  });

  it('deepest node is selected from nested path', () => {
    const coordinator = createStationarySelectionCoordinator();
    coordinator.beginTransaction();
    coordinator.recordNode('outer');
    coordinator.recordNode('inner');

    let selectedNodeId: string | null = null;
    coordinator.commitSelection(
      true,
      null,
      (id) => {
        selectedNodeId = id;
      },
      1,
    );

    expect(selectedNodeId).not.toBeNull();
    expect(typeof selectedNodeId).toBe('string');
    const isInner = selectedNodeId === 'inner';
    expect(isInner).toBe(true);
  });

  it('Edit selects exactly once', () => {
    let selectionCount = 0;

    const coordinator = createStationarySelectionCoordinator();
    coordinator.beginTransaction();
    coordinator.recordNode('node-a');
    coordinator.commitSelection(
      true,
      null,
      () => {
        selectionCount += 1;
      },
      1,
    );

    expect(selectionCount).toBe(1);
  });

  it('already-selected node invokes no selection callback', () => {
    const coordinator = createStationarySelectionCoordinator();
    coordinator.beginTransaction();
    coordinator.recordNode('node-a');

    let called = false;
    coordinator.commitSelection(
      true,
      'node-a',
      () => {
        called = true;
      },
      1,
    );

    expect(called).toBe(false);
  });

  it('Preview invokes no selection callback', () => {
    const coordinator = createStationarySelectionCoordinator();
    coordinator.beginTransaction();
    coordinator.recordNode('node-a');

    let selectedId: string | null = 'initial';
    const result = coordinator.commitSelection(
      false,
      null,
      (id) => {
        selectedId = id;
      },
      1,
    );

    expect(result).toBe('preview');
    expect(selectedId).toBe('initial');
    const tx = coordinator.getTransaction();
    expect(tx?.finalized).not.toBe(true);
  });

  it('moved transaction invokes no callback', () => {
    const coordinator = createStationarySelectionCoordinator();
    coordinator.beginTransaction();
    coordinator.recordNode('node-a');
    const tx = coordinator.getTransaction();
    if (tx) {
      tx.moved = true;
    }

    let selectedId: string | null = 'initial';
    const result = coordinator.commitSelection(
      true,
      null,
      (id) => {
        selectedId = id;
      },
      1,
    );

    expect(result).toBe('moved');
    expect(selectedId).toBe('initial');
  });

  it('empty path invokes no callback', () => {
    const coordinator = createStationarySelectionCoordinator();
    coordinator.beginTransaction();

    let selectedId: string | null = null;
    let selectionCount = 0;
    const result = coordinator.commitSelection(
      true,
      null,
      (id) => {
        selectedId = id;
        selectionCount += 1;
      },
      1,
    );

    expect(result).toBe('empty');
    expect(selectedId).toBeNull();
    expect(selectionCount).toBe(0);
  });

  it('stale generation commit returns stale', () => {
    const coordinator = createStationarySelectionCoordinator();
    coordinator.beginTransaction();
    coordinator.recordNode('node-a');
    coordinator.clearTransaction();

    let selectedId: string | null = null;
    const result = coordinator.commitSelection(
      true,
      null,
      (id) => {
        selectedId = id;
      },
      1,
    );

    expect(result).toBe('empty');
    expect(selectedId).toBeNull();
  });

  it('already-finalized commit returns already-finalized', () => {
    const coordinator = createStationarySelectionCoordinator();
    coordinator.beginTransaction();
    coordinator.recordNode('node-a');
    coordinator.commitSelection(
      true,
      null,
      (_id) => {
        void _id;
      },
      1,
    );

    let callCount = 0;
    const result = coordinator.commitSelection(
      true,
      null,
      () => {
        callCount += 1;
      },
      1,
    );

    expect(result).toBe('already-finalized');
    expect(callCount).toBe(0);
  });

  it('duplicate terminal event for the same generation does not double-commit', () => {
    const coordinator = createStationarySelectionCoordinator();
    let callCount = 0;

    const gen = coordinator.beginTransaction();
    coordinator.recordNode('node-a');

    coordinator.commitSelection(
      true,
      null,
      () => {
        callCount += 1;
      },
      gen,
    );

    const result = coordinator.commitSelection(
      true,
      null,
      () => {
        callCount += 1;
      },
      gen,
    );

    expect(callCount).toBe(1);
    expect(result).toBe('already-finalized');
  });

  it('ACTIVE/final terminal processing leaves no transaction', () => {
    const coordinator = createStationarySelectionCoordinator();
    coordinator.beginTransaction();
    coordinator.recordNode('node-a');
    coordinator.commitSelection(
      true,
      null,
      (_id) => {
        void _id;
      },
      1,
    );
    coordinator.clearTransaction();

    expect(coordinator.getTransaction()).toBeNull();
  });

  it('FAILED clears state', () => {
    const coordinator = createStationarySelectionCoordinator();
    coordinator.beginTransaction();
    coordinator.recordNode('node-a');
    coordinator.clearTransaction();

    expect(coordinator.getTransaction()).toBeNull();
  });

  it('CANCELLED clears state', () => {
    const coordinator = createStationarySelectionCoordinator();
    coordinator.beginTransaction();
    coordinator.recordNode('node-a');
    coordinator.clearTransaction();

    expect(coordinator.getTransaction()).toBeNull();
  });

  it('END clears state', () => {
    const coordinator = createStationarySelectionCoordinator();
    coordinator.beginTransaction();
    coordinator.recordNode('node-a');
    coordinator.clearTransaction();

    expect(coordinator.getTransaction()).toBeNull();
  });

  it('mode change clears active transaction', () => {
    const coordinator = createStationarySelectionCoordinator();
    coordinator.beginTransaction();
    coordinator.recordNode('node-a');
    coordinator.clearTransaction();

    expect(coordinator.getTransaction()).toBeNull();
  });

  it('no transaction survives completion', () => {
    const coordinator = createStationarySelectionCoordinator();
    coordinator.beginTransaction();
    coordinator.recordNode('node-a');
    coordinator.commitSelection(
      true,
      null,
      (_id) => {
        void _id;
      },
      1,
    );
    coordinator.clearTransaction();

    expect(coordinator.getTransaction()).toBeNull();
  });
});
