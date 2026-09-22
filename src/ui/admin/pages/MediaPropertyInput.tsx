import type {
  AppManifest,
  MediaAssetKind,
  MediaAssetReference,
} from '@ankhorage/contracts';
import { Button, Select, Text } from '@ankhorage/zora';
import { useRouter } from 'expo-router';
import React from 'react';
import { View } from 'react-native';

import {
  createStudioMediaAssetReference,
  listStudioMediaAssets,
  readStudioMediaAssetReference,
} from '../../../mediaAuthoringModel';

/*** Render a media-asset selector for one owner-described authoring field and surface missing references. */
export function MediaPropertyInput(props: {
  readonly value: unknown;
  readonly mediaKinds?: readonly MediaAssetKind[];
  readonly manifest: AppManifest;
  readonly onChange: (value: MediaAssetReference | undefined) => void;
}) {
  const { value, mediaKinds, manifest, onChange } = props;
  const router = useRouter();
  const assets = listStudioMediaAssets(manifest, mediaKinds);
  const reference = readStudioMediaAssetReference(value);
  const options = [
    { value: '', label: 'None' },
    ...assets.map((asset) => ({ value: asset.id, label: `${asset.name} · ${asset.kind}` })),
  ];
  const missing = reference && !manifest.media?.assets[reference.mediaId];

  return (
    <View style={{ gap: 8 }}>
      <Select
        value={reference?.mediaId ?? ''}
        options={options}
        onValueChange={(mediaId) =>
          onChange(mediaId ? createStudioMediaAssetReference(mediaId) : undefined)
        }
      />
      {missing ? (
        <Text color="danger" variant="bodySmall">
          Referenced media “{reference.mediaId}” is missing from the app media pool.
        </Text>
      ) : null}
      <Button onPress={() => router.push('/ankh/media')}>Manage media</Button>
    </View>
  );
}
