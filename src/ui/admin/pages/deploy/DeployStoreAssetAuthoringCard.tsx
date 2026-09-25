import type { ProjectStoreListingAssetLocation } from '@ankhorage/deploy/project';
import { Button, Card, Dialog, Text, View as ZoraView } from '@ankhorage/zora';
import React, { useState } from 'react';
import { View } from 'react-native';

import { resolveContractsAuthoringStructure } from '../../../../features/authoring-engine/adapters/outbound/resolveContractsAuthoringStructure';
import {
  removeProjectDeployListingAsset,
  writeProjectDeployListingAsset,
} from '../../../../projectDeployApi';
import { pickProjectDeployImage } from '../../../../projectDeployAssetPicker';
import { adminPageStyles, KeyValue } from '../../adminPagePrimitives';
import type { ProjectDeployDashboardState } from './deployDashboardTypes';
import { DeployOwnerAuthoringEditor } from './DeployOwnerAuthoringEditor';

type PickedImage = NonNullable<Awaited<ReturnType<typeof pickProjectDeployImage>>>;

const DEFAULT_ASSET_LOCATION: ProjectStoreListingAssetLocation = {
  kind: 'screenshot',
  target: 'android',
  locale: 'en-US',
  variant: 'phone',
  filename: '',
};

/*** Author a semantic store-asset location from Deploy metadata while keeping image I/O as workflow UI. */
export function DeployStoreAssetAuthoringCard(props: {
  readonly projectId: string;
  readonly authoring: ProjectDeployDashboardState['authoring'];
  readonly listing: ProjectDeployDashboardState['listing'];
  readonly onMutation: () => void;
}) {
  const [location, setLocation] =
    useState<ProjectStoreListingAssetLocation>(DEFAULT_ASSET_LOCATION);
  const [image, setImage] = useState<PickedImage | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [confirmRemove, setConfirmRemove] = useState(false);
  const structure =
    props.authoring.status === 'ready'
      ? resolveContractsAuthoringStructure(
          props.authoring.data.structure,
          'store-listing-asset-location',
        )
      : null;

  /*** Pick one local image while leaving semantic asset-location authoring to the shared engine. */
  const chooseImage = async () => {
    setError(null);
    try {
      const selected = await pickProjectDeployImage();
      if (!selected) return;
      setImage(selected);
      if (location.kind === 'screenshot') {
        setLocation({ ...location, filename: selected.filename });
      }
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : String(caught));
    }
  };

  /*** Upload the selected bytes to the currently authored Deploy semantic asset location. */
  const upload = async () => {
    if (!image) return;
    setBusy(true);
    setError(null);
    try {
      await writeProjectDeployListingAsset(props.projectId, location, image.data);
      props.onMutation();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : String(caught));
    } finally {
      setBusy(false);
    }
  };

  /*** Remove the currently authored semantic asset location through Deploy's owner API. */
  const remove = async () => {
    setConfirmRemove(false);
    setBusy(true);
    setError(null);
    try {
      await removeProjectDeployListingAsset(props.projectId, location);
      props.onMutation();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : String(caught));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Card
      title="Store assets"
      description="Asset-location variants and finite choices come from Deploy owner metadata. Image picking, upload and removal remain workflow operations."
    >
      {structure ? (
        <DeployOwnerAuthoringEditor
          structure={structure}
          value={location}
          onChange={setLocation}
          onError={setError}
        />
      ) : null}
      {props.authoring.status === 'loading' ? <Text>Loading authoring metadata…</Text> : null}
      {props.authoring.status === 'error' ? (
        <Text color="danger">{props.authoring.message}</Text>
      ) : null}
      <Button disabled={busy} variant="outline" onPress={() => void chooseImage()}>
        Choose PNG/JPEG
      </Button>
      {image ? (
        <KeyValue
          label="Selected image"
          value={`${image.filename} · ${image.data.byteLength} bytes`}
        />
      ) : null}
      {error ? <Text color="danger">{error}</Text> : null}
      <Button disabled={busy || image === null} onPress={() => void upload()}>
        {busy ? 'Working…' : 'Upload asset'}
      </Button>
      <Button disabled={busy} variant="outline" onPress={() => setConfirmRemove(true)}>
        Remove semantic location
      </Button>
      {props.listing.status === 'ready' ? (
        <View>
          <Text weight="semiBold">Current owner inventory</Text>
          {props.listing.data.assetSets.length === 0 ? (
            <Text color="neutral" emphasis="muted">
              No store assets authored yet.
            </Text>
          ) : (
            props.listing.data.assetSets.map((set) => (
              <View key={`${set.target}:${set.locale}:${set.variant}`} style={adminPageStyles.row}>
                <KeyValue
                  label={`${set.target} · ${set.locale} · ${set.variant}`}
                  value={`${set.assets.length} asset(s)`}
                />
                {set.assets.map((asset) => (
                  <Text
                    key={`${set.target}:${set.locale}:${set.variant}:${asset.relativePath}`}
                    color="neutral"
                    emphasis="muted"
                    variant="caption"
                  >
                    {asset.relativePath} · {asset.mediaType} · {asset.size} bytes
                  </Text>
                ))}
              </View>
            ))
          )}
        </View>
      ) : null}
      <Dialog
        visible={confirmRemove}
        title="Remove store asset?"
        description="Remove the selected semantic asset location through the Deploy owner API?"
        onDismiss={() => setConfirmRemove(false)}
        footer={
          <ZoraView direction={{ base: 'column', md: 'row' }} gap="s" justify="flex-end">
            <Button
              color="neutral"
              variant="soft"
              disabled={busy}
              onPress={() => setConfirmRemove(false)}
            >
              Cancel
            </Button>
            <Button color="danger" disabled={busy} onPress={() => void remove()}>
              Remove asset
            </Button>
          </ZoraView>
        }
      />
    </Card>
  );
}
