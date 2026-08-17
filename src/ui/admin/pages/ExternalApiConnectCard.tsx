import { Button, Card, Input, Select, Text } from '@ankhorage/zora';
import { useCallback, useState } from 'react';
import { View } from 'react-native';

import { useStudio } from '../../../core/StudioContext';
import { connectExternalApi } from '../../../externalApiApi';
import type {
  ExternalApiConnectResult,
  ExternalApiProtocol,
} from '../../../externalApiAuthoringContracts';
import {
  ExternalApiDiagnosticList,
  ExternalApiField,
  externalApiAdminStyles,
} from './ExternalApiAdminPrimitives';

const PROTOCOL_OPTIONS = [
  { value: 'auto', label: 'Auto: OpenAPI, then GraphQL' },
  { value: 'openapi', label: 'OpenAPI' },
  { value: 'graphql', label: 'GraphQL introspection' },
] as const;

export function ExternalApiConnectCard() {
  const studio = useStudio();
  const [apiId, setApiId] = useState('');
  const [url, setUrl] = useState('');
  const [name, setName] = useState('');
  const [protocol, setProtocol] = useState<ExternalApiProtocol>('auto');
  const [credentialId, setCredentialId] = useState('');
  const [credentialKind, setCredentialKind] = useState('bearer');
  const [credentialScope, setCredentialScope] = useState('');
  const [result, setResult] = useState<ExternalApiConnectResult | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const connect = useCallback(async () => {
    setBusy(true);
    setMessage(null);
    try {
      const next = await connectExternalApi(studio.projectId, {
        apiId,
        url,
        protocol,
        name: name.trim() || undefined,
        credential: credentialId.trim()
          ? {
              id: credentialId.trim(),
              kind: credentialKind.trim() || 'bearer',
              scope: credentialScope.trim() || undefined,
            }
          : undefined,
      });
      setResult(next);
      if (next.ok) {
        await studio.refetchManifest();
        setMessage(
          `${next.created ? 'Connected' : 'Updated'} API ${next.apiId} as ${next.protocol}.`,
        );
      }
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'External API connection failed.');
    } finally {
      setBusy(false);
    }
  }, [apiId, credentialId, credentialKind, credentialScope, name, protocol, studio, url]);

  return (
    <Card title="Connect external API">
      <View style={externalApiAdminStyles.stack}>
        <View style={externalApiAdminStyles.columns}>
          <ExternalApiField label="API ID">
            <Input value={apiId} autoCapitalize="none" onChangeText={setApiId} />
          </ExternalApiField>
          <ExternalApiField label="Protocol discovery">
            <Select value={protocol} options={PROTOCOL_OPTIONS} onValueChange={setProtocol} />
          </ExternalApiField>
        </View>
        <ExternalApiField label="Service or schema URL">
          <Input
            value={url}
            autoCapitalize="none"
            placeholder="https://api.example.com"
            onChangeText={setUrl}
          />
        </ExternalApiField>
        <ExternalApiField label="Display name (optional)">
          <Input value={name} onChangeText={setName} />
        </ExternalApiField>
        <Text color="neutral" emphasis="muted" variant="bodySmall">
          OpenAPI probes direct and conventional schema locations. GraphQL introspection uses the
          exact URL. Reusing an API ID updates the canonical infra.apis entry.
        </Text>
        <View style={externalApiAdminStyles.columns}>
          <ExternalApiField label="Credential secret ref (optional)">
            <Input
              value={credentialId}
              autoCapitalize="none"
              placeholder="services/example"
              onChangeText={setCredentialId}
            />
          </ExternalApiField>
          <ExternalApiField label="Credential kind">
            <Input value={credentialKind} autoCapitalize="none" onChangeText={setCredentialKind} />
          </ExternalApiField>
          <ExternalApiField label="Credential scope (optional)">
            <Input
              value={credentialScope}
              autoCapitalize="none"
              placeholder="header:x-api-key"
              onChangeText={setCredentialScope}
            />
          </ExternalApiField>
        </View>
        <View style={externalApiAdminStyles.actions}>
          <Button
            loading={busy}
            disabled={!apiId.trim() || !url.trim()}
            onPress={() => void connect()}
          >
            Connect API
          </Button>
        </View>
        {message ? <Text variant="bodySmall">{message}</Text> : null}
        {result ? (
          <ExternalApiDiagnosticList diagnostics={result.diagnostics} attempts={result.attempts} />
        ) : null}
      </View>
    </Card>
  );
}
