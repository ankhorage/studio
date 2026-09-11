import { Button, Card, Text, TextInput } from '@ankhorage/zora';
import { useCallback, useState } from 'react';
import { View } from 'react-native';

import { useStudio } from '../../../core/StudioContext';
import { deriveExternalApiIdFromUrl } from '../../../deriveExternalApiIdFromUrl';
import { connectExternalApi } from '../../../externalApiApi';
import type { ExternalApiConnectResult } from '../../../externalApiAuthoringContracts';
import {
  ExternalApiDiagnosticList,
  ExternalApiField,
  externalApiAdminStyles,
} from './ExternalApiAdminPrimitives';

interface ExternalApiDiscoveryFailure {
  readonly apiId: string;
  readonly url: string;
}

interface ExternalApiConnectCardProps {
  readonly onConnected: (apiId: string) => void;
  readonly onDiscoveryFailed: (failure: ExternalApiDiscoveryFailure) => void;
  readonly onResetFailure: () => void;
}

/*** Render URL-first external API discovery and persist the discovered canonical definition before exposing advanced authoring. */
export function ExternalApiConnectCard({
  onConnected,
  onDiscoveryFailed,
  onResetFailure,
}: ExternalApiConnectCardProps) {
  const studio = useStudio();
  const [url, setUrl] = useState('');
  const [result, setResult] = useState<ExternalApiConnectResult | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  /*** Reset stale discovery feedback whenever the URL draft changes while preserving the user's current input. */
  const changeUrl = useCallback(
    (value: string) => {
      setUrl(value);
      setResult(null);
      setMessage(null);
      onResetFailure();
    },
    [onResetFailure],
  );

  /*** Derive the canonical API id, run automatic discovery once, and refresh manifest state after successful persistence. */
  const discover = useCallback(async () => {
    if (busy) return;
    const normalizedUrl = url.trim();
    const derived = deriveExternalApiIdFromUrl(normalizedUrl);
    if (!derived.ok) {
      setResult(null);
      setMessage(derived.message);
      return;
    }

    setBusy(true);
    setMessage(null);
    try {
      const next = await connectExternalApi(studio.projectId, {
        apiId: derived.apiId,
        url: normalizedUrl,
        protocol: 'auto',
      });
      setResult(next);
      if (next.ok) {
        await studio.refetchManifest();
        setMessage(`Connected ${next.apiId} as ${next.protocol}.`);
        onConnected(next.apiId);
        return;
      }
      setMessage('Automatic discovery did not find a supported API definition.');
      onDiscoveryFailed({ apiId: derived.apiId, url: normalizedUrl });
    } catch (error) {
      setResult(null);
      setMessage(error instanceof Error ? error.message : 'External API discovery failed.');
      onDiscoveryFailed({ apiId: derived.apiId, url: normalizedUrl });
    } finally {
      setBusy(false);
    }
  }, [busy, onConnected, onDiscoveryFailed, studio, url]);

  return (
    <Card
      title="Connect an API"
      description="Start with the service or schema URL. Studio derives the API ID and discovers the protocol automatically."
    >
      <View style={externalApiAdminStyles.stack}>
        <ExternalApiField label="Service or schema URL">
          <TextInput
            accessibilityLabel="Service or schema URL"
            value={url}
            autoCapitalize="none"
            autoCorrect={false}
            placeholder="https://api.example.com/openapi.json"
            onChangeText={changeUrl}
            onSubmitEditing={() => void discover()}
          />
        </ExternalApiField>
        <View style={externalApiAdminStyles.actions}>
          <Button
            loading={busy}
            disabled={busy || !url.trim()}
            onPress={() => void discover()}
          >
            Discover API
          </Button>
        </View>
        <View accessibilityLiveRegion="polite">
          {busy ? <Text variant="bodySmall">Discovering API…</Text> : null}
          {message ? <Text variant="bodySmall">{message}</Text> : null}
        </View>
        {result ? (
          <ExternalApiDiagnosticList diagnostics={result.diagnostics} attempts={result.attempts} />
        ) : null}
      </View>
    </Card>
  );
}
