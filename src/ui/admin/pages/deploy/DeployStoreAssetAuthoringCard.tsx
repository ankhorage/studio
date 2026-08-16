import type { ProjectStoreListingAssetLocation } from '@ankhorage/deploy/project';
import { Button, Card, ConfirmDialog, Select, Text } from '@ankhorage/zora';
import React, { useState } from 'react';
import { View } from 'react-native';

import { pickProjectDeployImage } from '../../../../projectDeployAssetPicker';
import {
  removeProjectDeployListingAsset,
  writeProjectDeployListingAsset,
} from '../../../../projectDeployApi';
import { adminPageStyles, Field, Input, KeyValue } from '../../adminPagePrimitives';
import type { ProjectDeployDashboardState } from './deployDashboardTypes';

type AssetKind = 'screenshot' | 'android-shared';
type ScreenshotTarget = 'android' | 'ios';
type SharedVariant = 'icon' | 'feature';
type PickedImage = NonNullable<Awaited<ReturnType<typeof pickProjectDeployImage>>>;

const KIND_OPTIONS = [
  { value: 'screenshot', label: 'Store screenshot' },
  { value: 'android-shared', label: 'Android shared asset' },
] satisfies readonly { readonly value: AssetKind; readonly label: string }[];

const TARGET_OPTIONS = [
  { value: 'android', label: 'Android' },
  { value: 'ios', label: 'iOS' },
] satisfies readonly { readonly value: ScreenshotTarget; readonly label: string }[];

const SHARED_VARIANT_OPTIONS = [
  { value: 'icon', label: 'Icon' },
  { value: 'feature', label: 'Feature graphic' },
] satisfies readonly { readonly value: SharedVariant; readonly label: string }[];

export function DeployStoreAssetAuthoringCard(props: {
  readonly projectId: string;
  readonly listing: ProjectDeployDashboardState['listing'];
  readonly onMutation: () => void;
}) {
  const [kind, setKind] = useState<AssetKind>('screenshot');
  const [target, setTarget] = useState<ScreenshotTarget>('android');
  const [locale, setLocale] = useState('en-US');
  const [variant, setVariant] = useState('phone');
  const [sharedVariant, setSharedVariant] = useState<SharedVariant>('icon');
  const [filename, setFilename] = useState('');
  const [image, setImage] = useState<PickedImage | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [confirmRemove, setConfirmRemove] = useState(false);

  const location = createLocation({ kind, target, locale, variant, sharedVariant, filename });

  const chooseImage = async () => {
    setError(null);
    try {
      const selected = await pickProjectDeployImage();
      if (!selected) return;
      setImage(selected);
      if (kind === 'screenshot') setFilename(selected.filename);
    } catch (caught) {
      setError(readError(caught));
    }
  };

  const upload = async () => {
    if (!location || !image) return;
    setBusy(true);
    setError(null);
    try {
      await writeProjectDeployListingAsset(props.projectId, location, image.data);
      props.onMutation();
    } catch (caught) {
      setError(readError(caught));
    } finally {
      setBusy(false);
    }
  };

  const remove = async () => {
    if (!location) return;
    setConfirmRemove(false);
    setBusy(true);
    setError(null);
    try {
      await removeProjectDeployListingAsset(props.projectId, location);
      props.onMutation();
    } catch (caught) {
      setError(readError(caught));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Card
      title="Store assets"
      description="Upload or remove a semantic Deploy asset location. Studio never constructs Deploy filesystem paths."
    >
      <Field label="Asset kind">
        <Select value={kind} options={KIND_OPTIONS} onValueChange={setKind} />
      </Field>
      {kind === 'screenshot' ? (
        <>
          <Field label="Target">
            <Select value={target} options={TARGET_OPTIONS} onValueChange={setTarget} />
          </Field>
          <Field label="Locale">
            <Input value={locale} onChangeText={setLocale} />
          </Field>
          <Field label="Variant">
            <Input value={variant} placeholder="phone" onChangeText={setVariant} />
          </Field>
          <Field label="Filename">
            <Input value={filename} placeholder="01.png" onChangeText={setFilename} />
          </Field>
        </>
      ) : (
        <Field label="Android shared variant">
          <Select
            value={sharedVariant}
            options={SHARED_VARIANT_OPTIONS}
            onValueChange={setSharedVariant}
          />
        </Field>
      )}
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
      <Button disabled={busy || image === null || location === null} onPress={() => void upload()}>
        {busy ? 'Working…' : 'Upload asset'}
      </Button>
      <Button
        disabled={busy || location === null}
        variant="outline"
        onPress={() => setConfirmRemove(true)}
      >
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
      <ConfirmDialog
        visible={confirmRemove}
        title="Remove store asset?"
        description="Remove the selected semantic asset location through the Deploy owner API?"
        confirmLabel="Remove asset"
        confirmColor="danger"
        cancelLabel="Cancel"
        onCancel={() => setConfirmRemove(false)}
        onConfirm={() => void remove()}
      />
    </Card>
  );
}

function createLocation(input: {
  readonly kind: AssetKind;
  readonly target: ScreenshotTarget;
  readonly locale: string;
  readonly variant: string;
  readonly sharedVariant: SharedVariant;
  readonly filename: string;
}): ProjectStoreListingAssetLocation | null {
  if (input.kind === 'android-shared') {
    return { kind: 'android-shared', variant: input.sharedVariant };
  }
  const locale = input.locale.trim();
  const variant = input.variant.trim();
  const filename = input.filename.trim();
  if (locale === '' || variant === '' || filename === '') return null;
  return {
    kind: 'screenshot',
    target: input.target,
    locale,
    variant,
    filename,
  };
}

function readError(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
