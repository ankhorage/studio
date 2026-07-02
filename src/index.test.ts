import { describe, expect, test } from 'bun:test';

import {
  STUDIO_PACKAGE_BOUNDARY,
  STUDIO_PACKAGE_NAME,
  STUDIO_PUBLIC_CONTRACTS,
  type InsertCatalogEntry,
  type NodePlacement,
  type StudioAdminRoutePath,
  type StudioCommand,
  type StudioEvent,
  type StudioPanelId,
} from './index';

describe('@ankhorage/studio', () => {
  test('exports the package name', () => {
    expect(STUDIO_PACKAGE_NAME).toBe('@ankhorage/studio');
  });

  test('documents the package boundary', () => {
    expect(STUDIO_PACKAGE_BOUNDARY.owns).toContain('Studio authoring contracts');
    expect(STUDIO_PACKAGE_BOUNDARY.owns).toContain('Studio command and event contracts');
    expect(STUDIO_PACKAGE_BOUNDARY.consumes).toContain('@ankhorage/contracts');
    expect(STUDIO_PACKAGE_BOUNDARY.consumes).toContain('@ankhorage/runtime');
    expect(STUDIO_PACKAGE_BOUNDARY.doesNotOwn).toContain('Expo runtime planning');
    expect(STUDIO_PACKAGE_BOUNDARY.doesNotOwn).toContain('React Native UI components');
  });

  test('lists useful public contract exports', () => {
    expect(STUDIO_PUBLIC_CONTRACTS).toContain('StudioManifest');
    expect(STUDIO_PUBLIC_CONTRACTS).toContain('StudioContextValue');
    expect(STUDIO_PUBLIC_CONTRACTS).toContain('NodePlacement');
    expect(STUDIO_PUBLIC_CONTRACTS).toContain('InsertCatalogEntry');
  });

  test('accepts Studio navigation and selection literals', () => {
    const routePath: StudioAdminRoutePath = '/ankh/theme';
    const panelId: StudioPanelId = 'layers';

    expect(routePath).toBe('/ankh/theme');
    expect(panelId).toBe('layers');
  });

  test('models node placement without runtime dependencies', () => {
    const placement = {
      parentId: 'root',
      index: 0,
      kind: 'inside',
    } satisfies NodePlacement;

    expect(placement).toEqual({ parentId: 'root', index: 0, kind: 'inside' });
  });

  test('models insert catalog contracts without moving UI', () => {
    const entry = {
      id: 'component:Heading',
      label: 'Heading',
      category: 'component',
      rootType: 'Heading',
      kind: 'component',
      componentType: 'Heading',
      status: 'enabled',
    } satisfies InsertCatalogEntry;

    expect(entry.kind).toBe('component');
    expect(entry.status).toBe('enabled');
  });

  test('models Studio commands and events', () => {
    const command = {
      type: 'studio.selectNode',
      nodeId: 'node-1',
    } satisfies StudioCommand;
    const event = {
      type: 'studio.nodeSelected',
      nodeId: 'node-1',
    } satisfies StudioEvent;

    expect(command.type).toBe('studio.selectNode');
    expect(event.type).toBe('studio.nodeSelected');
  });
});
