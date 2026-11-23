import { type AppManifest, isAppManifest } from '@ankhorage/contracts';
import { RuntimeRenderer } from '@ankhorage/runtime';
import { isRecord } from '@ankhorage/utility/object';
import { ZORA_BASE_COMPONENT_REGISTRY } from '@ankhorage/zora/reader-free';
import React from 'react';
import { StyleSheet, View } from 'react-native';

import { studioApiBase } from '../utils/studioApiBase';
import { EmptyState, LoadingState, WorkspaceScreen } from './workspace/WorkspacePrimitives';

export function AcquisitionScreen() {
  const [preview, setPreview] = React.useState<AcquisitionPreviewState>({ status: 'loading' });

  React.useEffect(() => {
    const abortController = new AbortController();
    void loadAcquisitionPreviewAsync(abortController.signal)
      .then((result) => {
        if (!abortController.signal.aborted) setPreview({ status: 'ready', ...result });
      })
      .catch((error: unknown) => {
        if (abortController.signal.aborted) return;
        setPreview({
          status: 'error',
          message: error instanceof Error ? error.message : 'Acquisition preview unavailable.',
        });
      });

    return () => abortController.abort();
  }, []);

  if (preview.status !== 'ready') {
    return (
      <WorkspaceScreen title="Acquisition" subtitle="Canonical template preview">
        {preview.status === 'loading' ? (
          <LoadingState label="Loading Acquisition design" />
        ) : (
          <EmptyState title="Acquisition preview not available" detail={preview.message} />
        )}
      </WorkspaceScreen>
    );
  }

  const screen = preview.manifest.screens.acquisition;
  if (!screen) {
    return (
      <WorkspaceScreen title="Acquisition" subtitle="Canonical template preview">
        <EmptyState
          title="Acquisition screen missing"
          detail="The published Acquisition template does not declare its list screen."
        />
      </WorkspaceScreen>
    );
  }

  return (
    <View style={styles.root}>
      <RuntimeRenderer
        isRoot
        disableActions
        node={screen.root}
        registry={ZORA_BASE_COMPONENT_REGISTRY}
        dataBindings={preview.manifest.dataBindings}
        mediaAssets={preview.manifest.media?.assets}
        resolveMediaAsset={({ asset }) => preview.assets[asset.id] ?? null}
      />
    </View>
  );
}

type AcquisitionPreviewState =
  | { readonly status: 'loading' }
  | { readonly status: 'error'; readonly message: string }
  | {
      readonly status: 'ready';
      readonly manifest: AppManifest;
      readonly assets: Readonly<Record<string, string>>;
    };

/*** Load the published owner manifest through Studio's host, never from a sibling repository. */
async function loadAcquisitionPreviewAsync(signal: AbortSignal): Promise<{
  readonly manifest: AppManifest;
  readonly assets: Readonly<Record<string, string>>;
}> {
  const response = await fetch(
    `${studioApiBase}/templates/business_productivity/acquisition/preview`,
    { signal },
  );
  if (!response.ok) {
    throw new Error(
      response.status === 404
        ? 'The Acquisition template is not yet published. Templates PR #956 must be released first.'
        : 'The Studio host could not load the Acquisition manifest.',
    );
  }

  const payload: unknown = await response.json();
  if (!isRecord(payload) || !isAppManifest(payload.manifest) || !isRecord(payload.assets)) {
    throw new Error('The Studio host returned an invalid Acquisition preview manifest.');
  }
  const entries = Object.entries(payload.assets);
  const assets = entries.filter((entry): entry is [string, string] => typeof entry[1] === 'string');
  if (assets.length !== entries.length) {
    throw new Error('The Studio host returned an invalid Acquisition preview asset.');
  }

  return { manifest: payload.manifest, assets: Object.fromEntries(assets) };
}

const styles = StyleSheet.create({
  root: { flex: 1, minHeight: 0 },
});
