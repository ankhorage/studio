import { describe, expect, it } from 'bun:test';

import { createStationarySelectionCoordinator } from './stationarySelectionCoordinator';

describe('stationarySelectionCoordinator', () => {
  it('each new coordinator starts at generation 1', () => {
    const coordinator = createStationarySelectionCoordinator();
    const generation = coordinator.beginTransaction();

    expect(generation).toBe(1);
    const tx = coordinator.getTransaction();
    expect(tx).not.toBeNull();
    expect(tx?.transactionId).toBe(generation);
  });

  it('second transaction uses generation 2', () => {
    const coordinator = createStationarySelectionCoordinator();
    const generation1 = coordinator.beginTransaction();
    coordinator.clearTransaction();
    const generation2 = coordinator.beginTransaction();

    expect(generation2).toBe(generation1 + 1);
  });

  it('stale record generation rejected', () => {
    const coordinator = createStationarySelectionCoordinator();
    const gen1 = coordinator.beginTransaction();
    coordinator.recordNode('node-a', gen1);
    coordinator.clearTransaction();

    const gen2 = coordinator.beginTransaction();
    coordinator.recordNode('node-a', gen1);

    const tx = coordinator.getTransaction();
    expect(tx?.transactionId).toBe(gen2);
    expect(tx?.path).toEqual([]);
  });

  it('stale commit generation rejected', () => {
    const coordinator = createStationarySelectionCoordinator();
    const gen1 = coordinator.beginTransaction();
    coordinator.recordNode('node-a', gen1);
    coordinator.clearTransaction();

    const result = coordinator.commitSelection(
      true,
      null,
      () => {
        void 0;
      },
      gen1,
    );

    expect(result).toBe('empty');
  });

  it('duplicate node rejected', () => {
    const coordinator = createStationarySelectionCoordinator();
    const gen = coordinator.beginTransaction();
    coordinator.recordNode('node-a', gen);
    coordinator.recordNode('node-a', gen);

    const tx = coordinator.getTransaction();
    expect(tx?.path).toEqual(['node-a']);
  });

  it('bubble path inner-to-outer', () => {
    const coordinator = createStationarySelectionCoordinator();
    const gen = coordinator.beginTransaction();
    coordinator.recordNode('inner', gen);
    coordinator.recordNode('outer', gen);

    const tx = coordinator.getTransaction();
    expect(tx?.path).toEqual(['inner', 'outer']);
  });

  it('first node is deepest', () => {
    const coordinator = createStationarySelectionCoordinator();
    const gen = coordinator.beginTransaction();
    coordinator.recordNode('inner', gen);
    coordinator.recordNode('outer', gen);

    let selectedNodeId: string | null = null;
    coordinator.commitSelection(
      true,
      null,
      (id) => {
        selectedNodeId = id;
      },
      gen,
    );

    expect(selectedNodeId as unknown as string).toBe('inner');
  });

  it('Edit commit once', () => {
    let callCount = 0;
    const coordinator = createStationarySelectionCoordinator();
    const gen = coordinator.beginTransaction();
    coordinator.recordNode('node-a', gen);
    coordinator.commitSelection(
      true,
      null,
      () => {
        callCount += 1;
      },
      gen,
    );

    expect(callCount).toBe(1);
  });

  it('already-selected callback omitted', () => {
    let called = false;
    const coordinator = createStationarySelectionCoordinator();
    const gen = coordinator.beginTransaction();
    coordinator.recordNode('node-a', gen);
    coordinator.commitSelection(
      true,
      'node-a',
      () => {
        called = true;
      },
      gen,
    );

    expect(called).toBe(false);
  });

  it('Preview callback omitted', () => {
    let selectedId: string | null = 'initial';
    const coordinator = createStationarySelectionCoordinator();
    const gen = coordinator.beginTransaction();
    coordinator.recordNode('node-a', gen);
    const result = coordinator.commitSelection(
      false,
      null,
      (id) => {
        selectedId = id;
      },
      gen,
    );

    expect(result).toBe('preview');
    expect(selectedId).toBe('initial');
    const tx = coordinator.getTransaction();
    expect(tx?.finalized).not.toBe(true);
  });

  it('empty path', () => {
    let selectedId: string | null = null;
    let callCount = 0;
    const coordinator = createStationarySelectionCoordinator();
    const gen = coordinator.beginTransaction();
    const result = coordinator.commitSelection(
      true,
      null,
      (id) => {
        selectedId = id;
        callCount += 1;
      },
      gen,
    );

    expect(result).toBe('empty');
    expect(selectedId).toBeNull();
    expect(callCount).toBe(0);
  });

  it('moved transaction', () => {
    let selectedId: string | null = 'initial';
    const coordinator = createStationarySelectionCoordinator();
    const gen = coordinator.beginTransaction();
    coordinator.recordNode('node-a', gen);
    coordinator.markMoved(gen);
    const result = coordinator.commitSelection(
      true,
      null,
      (id) => {
        selectedId = id;
      },
      gen,
    );

    expect(result).toBe('moved');
    expect(selectedId).toBe('initial');
  });

  it('already-finalized transaction', () => {
    const coordinator = createStationarySelectionCoordinator();
    const gen = coordinator.beginTransaction();
    coordinator.recordNode('node-a', gen);
    coordinator.commitSelection(
      true,
      null,
      () => {
        void 0;
      },
      gen,
    );

    let callCount = 0;
    const result = coordinator.commitSelection(
      true,
      null,
      () => {
        callCount += 1;
      },
      gen,
    );

    expect(result).toBe('already-finalized');
    expect(callCount).toBe(0);
  });

  it('cleanup only for matching generation', () => {
    const coordinator = createStationarySelectionCoordinator();
    const gen1 = coordinator.beginTransaction();
    coordinator.recordNode('node-a', gen1);
    coordinator.commitSelection(
      true,
      null,
      () => {
        void 0;
      },
      gen1,
    );

    const gen2 = coordinator.beginTransaction();
    coordinator.recordNode('node-b', gen2);
    coordinator.clearTransaction(gen1);

    const tx = coordinator.getTransaction();
    expect(tx?.transactionId).toBe(gen2);
    expect(tx?.path).toEqual(['node-b']);
  });

  it('stale finalization cannot clear a newer transaction', () => {
    const coordinator = createStationarySelectionCoordinator();
    const gen1 = coordinator.beginTransaction();
    coordinator.clearTransaction(gen1);

    const gen2 = coordinator.beginTransaction();
    coordinator.recordNode('node-a', gen2);
    coordinator.clearTransaction(gen1);

    const tx = coordinator.getTransaction();
    expect(tx?.transactionId).toBe(gen2);
    expect(tx?.path).toEqual(['node-a']);
  });

  it('no transaction survives matching finalization', () => {
    const coordinator = createStationarySelectionCoordinator();
    const gen = coordinator.beginTransaction();
    coordinator.recordNode('node-a', gen);
    coordinator.commitSelection(
      true,
      null,
      () => {
        void 0;
      },
      gen,
    );
    coordinator.clearTransaction(gen);

    expect(coordinator.getTransaction()).toBeNull();
  });
});
