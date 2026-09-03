import type { AppManifest } from '@ankhorage/contracts';
import { Button, Select, Text } from '@ankhorage/zora';
import { useRouter } from 'expo-router';
import React from 'react';
import { View } from 'react-native';

import {
  createStudioMediaAssetReference,
  listStudioMediaAssets,
  readStudioMediaAssetReference,
} from '../../../mediaAuthoringModel';
import type {
  StudioInstancePropertyField,
  StudioInstancePropertyValue,
} from '../../../propertiesAuthoringModel';

/*** Render a media-asset selector for one media-backed Studio instance property and surface missing references. */
export function MediaPropertyInput(props: {
  readonly field: StudioInstancePropertyField;
  readonly manifest: AppManifest;
  readonly onChange: (value: StudioInstancePropertyValue | undefined) => void;
}) {
  const { field, manifest, onChange } = props;
  const router = useRouter();
  const assets = listStudioMediaAssets(manifest, field.mediaKinds);
  const reference = readStudioMediaAssetReference(field.value);
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
