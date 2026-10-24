import { expect, test } from 'bun:test';

import { getStudioAppHeaderTsx } from './studioAppHeader';
import { getStudioShellTsx } from './studioShell';

const studioShell = getStudioShellTsx({
  imports: '',
  zoraComponentRegistry: 'ZORA_COMPONENT_REGISTRY',
});
const studioAppHeader = getStudioAppHeaderTsx('');

test('owns Studio route state, app chrome, and provider composition', () => {
  expect(studioShell).toContain('resolveStudioAppHeaderTitle({');
  expect(studioAppHeader).toContain('function resolveStudioPreviewHeaderTitle(');
  expect(studioAppHeader).toContain('function resolveRuntimeAppHeaderTitle(');
  expect(studioAppHeader).toContain('function resolveManifestScreen(');
  expect(studioShell).toContain('resolveStudioLastNonAdminLocation({');
  expect(studioShell).toContain('if (nextAppLocation) setLastNonAdminLocation(nextAppLocation);');
  expect(studioShell).toContain(
    'const activeStudioTheme = resolveManifestActiveTheme(studioRuntimeManifest);',
  );
  expect(studioShell).toContain('const themeConfig = useMemo(');
  expect(studioShell).toContain(
    '<ZoraProvider themeConfig={themeConfig} initialMode={initialMode}>',
  );
  expect(studioAppHeader).toContain(
    '<AppBar title={appHeaderTitle} actions={studioAppBar.actions} />',
  );
  expect(studioAppHeader).not.toContain('appMode={studioAppBar.appMode}');
  expect(studioAppHeader).not.toContain('overflow={studioAppBar.overflow}');
  expect(studioShell).toContain('<StudioStatusBar />');
});

test('keeps admin routes outside Studio stationary selection composition', () => {
  expect(studioShell).toContain('const studioOutput = isStudioAdminPath(appPathname) ? (');
  expect(studioShell).toContain('<StationaryTapSelector');
  expect(studioShell).toContain('createStudioStationarySelectionWrapNode');
  expect(studioShell).toContain('createStudioInteractionPolicyResolver');
  expect(studioShell).toContain('createStudioActionSuppressionConfig(previewMode)');
  expect(studioShell).toContain('resolveNodeProps: studioResolveNodeProps');
  expect(studioShell).toContain('wrapNode: studioWrapNode');
  expect(studioShell).toContain('selectedNodeId');
  expect(studioShell).toContain('selectNode');
  expect(studioShell).toContain('canvasInteraction={{');
  expect(studioShell).toContain('activeDragNodeId: selection.activeCanvasDragNodeId');
  expect(studioShell).toContain('moveNodeToPlacement: selection.moveNodeToPlacement');
  expect(studioShell).toContain('setActiveDragNodeId: selection.setActiveCanvasDragNodeId');
  expect(studioShell).toContain('APP_EXTENSION_INTERACTION_POLICY_SUPPORT');
});

test('scopes Studio runtime selection config below StudioProvider', () => {
  expect(studioShell).toContain(
    'const studioRuntimeConfig = useStudioRuntimeConfig(studio.previewMode);',
  );
  expect(studioShell).toContain('const studioWrapNode = useMemo(');
  expect(studioShell).toContain('builtInComponentRegistry: ZORA_COMPONENT_REGISTRY');
  expect(studioShell).toContain('const studioResolveNodeProps = useMemo(');
  expect(studioShell).toContain('selectionColor={theme.semantics.action.primary.base}');
  expect(studioShell).not.toContain('registry: create');
  expect(studioShell).toContain(
    '<RuntimeRendererConfigProvider value={runtimeConfig}>{output}</RuntimeRendererConfigProvider>',
  );
  expect(studioShell).toContain('[previewMode, studioResolveNodeProps, studioWrapNode]');
  expect(studioShell).not.toContain('runtimeConfig={generatedRuntimeConfig}');
});
