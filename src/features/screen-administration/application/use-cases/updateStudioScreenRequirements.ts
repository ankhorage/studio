import type { AppManifest, ScreenRequirements } from '@ankhorage/contracts';

export type ScreenRequirementsManifest = Pick<AppManifest, 'screens'>;

/***
 * Replace one screen's explicit requirements while preserving identity, metadata, UI, and loaders.
 */
export function updateStudioScreenRequirements<TManifest extends ScreenRequirementsManifest>(
  manifest: TManifest,
  screenId: string,
  requirements: ScreenRequirements | undefined,
):
  | { readonly ok: true; readonly manifest: TManifest }
  | { readonly ok: false; readonly manifest: TManifest } {
  const screen = Object.entries(manifest.screens).find(([key]) => key === screenId)?.[1];
  if (screen?.id !== screenId) return { ok: false, manifest };

  const normalized = normalizeScreenRequirements(requirements);
  const { requires: _currentRequirements, ...screenWithoutRequirements } = screen;
  const nextScreen = {
    ...screenWithoutRequirements,
    ...(normalized ? { requires: normalized } : {}),
  };
  const screens: AppManifest['screens'] = Object.fromEntries(
    Object.entries(manifest.screens).map(([key, value]) => [
      key,
      key === screenId ? nextScreen : value,
    ]),
  );

  return {
    ok: true,
    manifest: {
      ...manifest,
      screens,
    },
  };
}

/*** Prune empty requirement families and omit the screen requirements object when no membership remains. */
function normalizeScreenRequirements(
  requirements: ScreenRequirements | undefined,
): ScreenRequirements | undefined {
  if (!requirements) return undefined;

  const permissions =
    requirements.permissions && Object.keys(requirements.permissions).length > 0
      ? requirements.permissions
      : undefined;
  const capabilities =
    requirements.capabilities && Object.keys(requirements.capabilities).length > 0
      ? requirements.capabilities
      : undefined;

  if (!permissions && !capabilities) return undefined;
  return {
    ...(permissions ? { permissions } : {}),
    ...(capabilities ? { capabilities } : {}),
  };
}
