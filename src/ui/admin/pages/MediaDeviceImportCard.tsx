import { Button, Card, Text } from '@ankhorage/zora';
import React, { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { useStudio } from '../../../core/StudioContext';
import type { StudioMediaPickerSource } from '../../../mediaPickerAuthoring';

export function MediaDeviceImportCard() {
  const studio = useStudio();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const importMedia = async (source: StudioMediaPickerSource) => {
    setBusy(true);
    setError(null);
    const result = await studio.ingestMediaFromPicker(source);
    setBusy(false);
    if (!result.ok && result.reason !== 'cancelled') setError(result.reason);
  };

  return (
    <Card
      title="Import from device"
      description="Selected local files are ingested through the trusted Studio host before entering the manifest."
    >
      <View style={styles.actions}>
        <Button disabled={busy || !studio.mediaPickerAvailable} onPress={() => void importMedia('file')}>
          Choose file
        </Button>
        <Button
          disabled={busy || !studio.mediaPickerAvailable}
          onPress={() => void importMedia('photo-library')}
        >
          Photo library
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
