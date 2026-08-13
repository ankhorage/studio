import { MEDIA_ASSET_KINDS, type MediaAsset, type MediaAssetKind } from '@ankhorage/contracts';
import { Button, Card, Input, Select, Text } from '@ankhorage/zora';
import React, { useMemo, useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { useStudio } from '../../../core/StudioContext';
import {
  collectStudioMediaAssetUsages,
  createStudioMediaAssetId,
  createStudioUrlMediaAsset,
  listStudioMediaAssets,
  type StudioMediaDeleteResult,
} from '../../../mediaAuthoringModel';
import { AdminHeader, AdminScroll, Field, KeyValue } from '../adminPagePrimitives';
import { MediaDeviceImportCard } from './MediaDeviceImportCard';

const MEDIA_KIND_OPTIONS = MEDIA_ASSET_KINDS.map((value) => ({
  value,
  label: value[0]?.toUpperCase() + value.slice(1),
})) satisfies readonly { value: MediaAssetKind; label: string }[];

export function MediaAdminPage() {
  const studio = useStudio();
  const [name, setName] = useState('');
  const [url, setUrl] = useState('');
  const [kind, setKind] = useState<MediaAssetKind>('image');
  const [error, setError] = useState<string | null>(null);
  const [deleteNotice, setDeleteNotice] = useState<string | null>(null);
  const assets = useMemo(
    () => (studio.manifest ? listStudioMediaAssets(studio.manifest) : []),
    [studio.manifest],
  );

  if (!studio.manifest) {
    return (
      <AdminScroll>
        <AdminHeader
          title="Media"
          description="The app media pool is available after the manifest loads."
        />
      </AdminScroll>
    );
  }

  const importUrl = () => {
    const id = createStudioMediaAssetId(name || 'media', studio.manifest?.media?.assets);
    const result = createStudioUrlMediaAsset({ id, name: name || id, kind, url });
    if (!result.ok) {
      setError('Use a stable HTTP(S) URL without embedded credentials.');
      return;
    }
    studio.upsertMediaAsset(result.asset);
    setName('');
    setUrl('');
    setError(null);
  };

  return (
    <AdminScroll>
      <AdminHeader
        title="Media"
        description="Canonical app-authoring media. Runtime user uploads are intentionally not shown here."
      />
      <MediaDeviceImportCard />
      <Card
        title="Import external URL"
        description="The URL remains remote and is stored as a stable media source."
      >
        <View style={styles.formStack}>
          <Field label="Name">
            <Input value={name} placeholder="Hero image" onChangeText={setName} />
          </Field>
          <Field label="Kind">
            <Select value={kind} options={MEDIA_KIND_OPTIONS} onValueChange={setKind} />
          </Field>
          <Field label="HTTP(S) URL">
            <Input
              value={url}
              placeholder="https://…"
              onChangeText={setUrl}
              autoCapitalize="none"
            />
          </Field>
          {error ? (
            <Text color="danger" variant="bodySmall">
              {error}
            </Text>
          ) : null}
          <Button disabled={!url.trim()} onPress={importUrl}>
            Import URL
          </Button>
        </View>
      </Card>
      {deleteNotice ? (
        <Card title="Media lifecycle notice">
          <Text color="danger" variant="bodySmall">
            {deleteNotice}
          </Text>
        </Card>
      ) : null}
      {assets.length === 0 ? (
        <Card title="No media yet">
          <Text color="neutral" emphasis="muted">
            Import a device file, photo-library item, or stable external URL.
          </Text>
        </Card>
      ) : null}
      {assets.map((asset) => (
        <MediaAssetCard key={asset.id} asset={asset} onDeleteNotice={setDeleteNotice} />
      ))}
    </AdminScroll>
  );
}

function MediaAssetCard({
  asset,
  onDeleteNotice,
}: {
  readonly asset: MediaAsset;
  readonly onDeleteNotice: (message: string | null) => void;
}) {
  const studio = useStudio();
  const usages = studio.manifest ? collectStudioMediaAssetUsages(studio.manifest, asset.id) : [];
  const metadata = asset.metadata;
  const removeAsset = async () => {
    const result = await studio.deleteMediaAsset(asset.id);
    onDeleteNotice(formatDeleteNotice(result));
  };
  return (
    <Card title={asset.name} description={formatMediaSource(asset)}>
      <View style={styles.details}>
        <KeyValue label="ID" value={asset.id} />
        <KeyValue label="Kind" value={asset.kind} />
        {asset.contentType ? <KeyValue label="Content type" value={asset.contentType} /> : null}
        {metadata?.sizeBytes !== undefined ? (
          <KeyValue label="Size" value={`${metadata.sizeBytes} bytes`} />
        ) : null}
        {metadata?.width !== undefined && metadata.height !== undefined ? (
          <KeyValue label="Dimensions" value={`${metadata.width} × ${metadata.height}`} />
        ) : null}
        {metadata?.durationMs !== undefined ? (
          <KeyValue label="Duration" value={`${metadata.durationMs} ms`} />
        ) : null}
        <KeyValue
          label="Usage"
          value={usages.length === 0 ? 'Unused' : `${usages.length} reference(s)`}
        />
        <Button disabled={usages.length > 0} onPress={() => void removeAsset()}>
          Remove media
        </Button>
        {usages.length > 0 ? (
          <Text color="neutral" emphasis="muted" variant="bodySmall">
            Remove references from component properties before deleting this media item.
          </Text>
        ) : null}
      </View>
    </Card>
  );
}

function formatDeleteNotice(result: StudioMediaDeleteResult): string | null {
  if (result.ok) return null;
  if (result.reason === 'save-failed') {
    return `The manifest did not save, so no physical media source was removed: ${result.message}`;
  }
  if (result.reason === 'cleanup-failed') {
    return `The media item was removed safely, but an orphaned authoring source may remain: ${result.message}`;
  }
  if (result.reason === 'in-use') return 'The media item is still referenced by component properties.';
  return 'The media item no longer exists in the authoring pool.';
}

function formatMediaSource(asset: MediaAsset): string {
  if (asset.source.kind === 'url') return asset.source.url;
  if (asset.source.kind === 'bundled') return `Bundled · ${asset.source.path}`;
  return `Storage · ${asset.source.storageId ? `${asset.source.storageId} · ` : ''}${asset.source.bucket}/${asset.source.path}`;
}

const styles = StyleSheet.create({
  formStack: { gap: 12 },
  details: { gap: 8 },
});
