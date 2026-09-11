import type { DataOperationIntent } from '@ankhorage/contracts/data';
import { Button, ButtonGroup, Card, Select, Text, TextInput } from '@ankhorage/zora';
import { useCallback, useState } from 'react';
import { View } from 'react-native';

import { useStudio } from '../../../core/StudioContext';
import { createManualRestApi } from '../../../externalApiApi';
import type { ExternalApiConnectResult } from '../../../externalApiAuthoringContracts';
import {
  ExternalApiDiagnosticList,
  ExternalApiField,
  externalApiAdminStyles,
} from './ExternalApiAdminPrimitives';

interface ManualRestApiCardProps {
  readonly apiId: string;
  readonly attemptedUrl: string;
  readonly onRetry: () => void;
  readonly onSaved: (apiId: string) => void;
}

/*** Render a focused manual REST fallback after automatic discovery fails, retaining the attempted URL and canonical API id. */
export function ManualRestApiCard({
  apiId,
  attemptedUrl,
  onRetry,
  onSaved,
}: ManualRestApiCardProps) {
  const studio = useStudio();
  const [baseUrl, setBaseUrl] = useState(attemptedUrl);
  const [endpointId, setEndpointId] = useState('root');
  const [path, setPath] = useState('/');
  const [operationId, setOperationId] = useState('get-root');
  const [method, setMethod] = useState('GET');
  const [intent, setIntent] = useState<DataOperationIntent>('read');
  const [result, setResult] = useState<ExternalApiConnectResult | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  /*** Persist the focused manual REST fallback and refresh the canonical Studio manifest on success. */
  const save = useCallback(async () => {
    if (busy) return;
    setBusy(true);
    setMessage(null);
    try {
      const next = await createManualRestApi(studio.projectId, {
        apiId,
        baseUrl,
        endpointId,
        path,
        operationId,
        method,
        intent,
      });
      setResult(next);
      if (next.ok) {
        await studio.refetchManifest();
        onSaved(next.apiId);
        return;
      }
      setMessage(next.diagnostics[0]?.message ?? 'Manual REST API creation failed.');
    } catch (error) {
      setResult(null);
      setMessage(error instanceof Error ? error.message : 'Manual REST API creation failed.');
    } finally {
      setBusy(false);
    }
  }, [apiId, baseUrl, busy, endpointId, intent, method, onSaved, operationId, path, studio]);

  return (
    <Card
      title="Manual REST fallback"
      description="Automatic discovery did not find a supported definition. Describe the first REST operation without creating another API model."
    >
      <View style={externalApiAdminStyles.stack}>
        <Text color="neutral" emphasis="muted" variant="bodySmall">
          Studio will persist this through the same canonical infra.apis entry. Retry discovery at any
          time without losing the URL above.
        </Text>
        <ExternalApiField label="Generated API ID">
          <Text selectable variant="bodySmall">
            {apiId}
          </Text>
        </ExternalApiField>
        <ExternalApiField label="Base URL">
          <TextInput
            accessibilityLabel="Manual REST base URL"
            value={baseUrl}
            autoCapitalize="none"
            autoCorrect={false}
            onChangeText={setBaseUrl}
          />
        </ExternalApiField>
        <View style={externalApiAdminStyles.columns}>
          <ExternalApiField label="Endpoint ID">
            <TextInput
              accessibilityLabel="Endpoint ID"
              value={endpointId}
              autoCapitalize="none"
              onChangeText={setEndpointId}
            />
          </ExternalApiField>
          <ExternalApiField label="Path">
            <TextInput
              accessibilityLabel="Endpoint path"
              value={path}
              autoCapitalize="none"
              onChangeText={setPath}
            />
          </ExternalApiField>
          <ExternalApiField label="Operation ID">
            <TextInput
              accessibilityLabel="Operation ID"
              value={operationId}
              autoCapitalize="none"
              onChangeText={setOperationId}
            />
          </ExternalApiField>
        </View>
        <View style={externalApiAdminStyles.columns}>
          <ExternalApiField label="HTTP method">
            <Select value={method} options={METHOD_OPTIONS} onValueChange={setMethod} />
          </ExternalApiField>
          <ExternalApiField label="Intent">
            <Select value={intent} options={INTENT_OPTIONS} onValueChange={setIntent} />
          </ExternalApiField>
        </View>
        <ButtonGroup orientation="responsive" align="end">
          <Button variant="outline" disabled={busy} onPress={onRetry}>
            Retry discovery
          </Button>
          <Button
            loading={busy}
            disabled={busy || !baseUrl.trim() || !path.trim()}
            onPress={() => void save()}
          >
            Save REST API
          </Button>
        </ButtonGroup>
        <View accessibilityLiveRegion="polite">
          {message ? <Text variant="bodySmall">{message}</Text> : null}
        </View>
        {result && !result.ok ? (
          <ExternalApiDiagnosticList diagnostics={result.diagnostics} attempts={result.attempts} />
        ) : null}
      </View>
    </Card>
  );
}

const METHOD_OPTIONS = ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'].map((value) => ({
  value,
  label: value,
}));

const INTENT_OPTIONS: readonly { value: DataOperationIntent; label: string }[] = [
  { value: 'read', label: 'Read' },
  { value: 'create', label: 'Create' },
  { value: 'update', label: 'Update' },
  { value: 'delete', label: 'Delete' },
  { value: 'action', label: 'Action' },
];
