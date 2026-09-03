import { Button, Card, Text } from '@ankhorage/zora';
import React, { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { useStudio } from '../../../core/StudioContext';
import type {
  StudioMediaIngestTarget,
  StudioMediaPickerSource,
} from '../../../mediaPickerAuthoring';

/*** Render device/photo-library import actions for managed-storage and bundled Studio authoring media. */
export function MediaDeviceImportCard() {
  const studio = useStudio();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  /*** Invoke the configured platform media picker and ingest the selection into the requested Studio media target. */
  const importMedia = async (source: StudioMediaPickerSource, target: StudioMediaIngestTarget) => {
    setBusy(true);
    setError(null);
    const result = await studio.ingestMediaFromPicker(source, target);
    setBusy(false);
    if (!result.ok && result.reason !== 'cancelled') setError(result.reason);
  };

  return (
    <Card
      title="Import from device"
      description="Use managed storage for remote authoring media, or bundle files into the app under /assets."
    >
      <Text color="neutral" emphasis="muted" variant="bodySmall">
        Managed storage
      </Text>
      <View style={styles.actions}>
        <Button
          disabled={busy || !studio.mediaPickerAvailable}
          onPress={() => void importMedia('file', 'storage')}
        >
          Upload file
        </Button>
        <Button
          disabled={busy || !studio.mediaPickerAvailable}
          onPress={() => void importMedia('photo-library', 'storage')}
        >
          Upload photo
        </Button>
      </View>
      <Text color="neutral" emphasis="muted" variant="bodySmall">
        App bundle
      </Text>
      <View style={styles.actions}>
        <Button
          disabled={busy || !studio.mediaPickerAvailable}
          onPress={() => void importMedia('file', 'bundled')}
        >
          Bundle file
        </Button>
        <Button
          disabled={busy || !studio.mediaPickerAvailable}
          onPress={() => void importMedia('photo-library', 'bundled')}
        >
          Bundle photo
        </Button>
      </View>
      {!studio.mediaPickerAvailable ? (
        <Text color="neutral" emphasis="muted" variant="bodySmall">
          This Studio host has no platform media picker adapter.
        </Text>
      ) : null}
      {error ? (
        <Text color="danger" variant="bodySmall">
          {error}
        </Text>
      ) : null}
    </Card>
  );
}

const styles = StyleSheet.create({ actions: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 } });
