import type { DataOperationIntent } from '@ankhorage/contracts/data';
import { Button, Card, Input, Select, Text } from '@ankhorage/zora';
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

export function ManualRestSourceCard() {
  const studio = useStudio();
  const [apiId, setApiId] = useState('');
  const [baseUrl, setBaseUrl] = useState('');
  const [endpointId, setEndpointId] = useState('root');
  const [path, setPath] = useState('/');
  const [operationId, setOperationId] = useState('get-root');
  const [method, setMethod] = useState('GET');
  const [intent, setIntent] = useState<DataOperationIntent>('read');
  const [result, setResult] = useState<ExternalApiConnectResult | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const save = useCallback(async () => {
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
        setMessage(`${next.created ? 'Created' : 'Updated'} manual REST API ${next.apiId}.`);
      }
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Manual REST API creation failed.');
    } finally {
      setBusy(false);
    }
  }, [apiId, baseUrl, endpointId, intent, method, operationId, path, studio]);

  return (
    <Card title="Manual external REST API">
      <View style={externalApiAdminStyles.stack}>
        <Text color="neutral" emphasis="muted" variant="bodySmall">
          Use this when no OpenAPI document exists. The API is persisted directly in infra.apis.
        </Text>
        <View style={externalApiAdminStyles.columns}>
          <ExternalApiField label="API ID">
            <Input value={apiId} autoCapitalize="none" onChangeText={setApiId} />
          </ExternalApiField>
          <ExternalApiField label="Base URL">
            <Input value={baseUrl} autoCapitalize="none" onChangeText={setBaseUrl} />
          </ExternalApiField>
        </View>
        <View style={externalApiAdminStyles.columns}>
          <ExternalApiField label="Endpoint ID">
            <Input value={endpointId} autoCapitalize="none" onChangeText={setEndpointId} />
          </ExternalApiField>
          <ExternalApiField label="Path">
            <Input value={path} autoCapitalize="none" onChangeText={setPath} />
          </ExternalApiField>
          <ExternalApiField label="Operation ID">
            <Input value={operationId} autoCapitalize="none" onChangeText={setOperationId} />
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
        <View style={externalApiAdminStyles.actions}>
          <Button
            loading={busy}
            disabled={!apiId.trim() || !baseUrl.trim() || !path.trim()}
            onPress={() => void save()}
          >
            Save REST API
          </Button>
        </View>
        {message ? <Text variant="bodySmall">{message}</Text> : null}
        {result ? <ExternalApiDiagnosticList diagnostics={result.diagnostics} /> : null}
      </View>
    </Card>
  );
}
