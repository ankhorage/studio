import type { ApiDefinition, DataSourceDiagnostic } from '@ankhorage/contracts/data';
import { Button, ButtonGroup, Card, Select, Text, TextInput } from '@ankhorage/zora';
import { useCallback, useState } from 'react';
import { View } from 'react-native';

import { useStudio } from '../../../core/StudioContext';
import { connectExternalApi, updateManualRestApi } from '../../../externalApiApi';
import type { ExternalApiProtocol } from '../../../externalApiAuthoringContracts';
import {
  ExternalApiDiagnosticList,
  ExternalApiField,
  externalApiAdminStyles,
} from './ExternalApiAdminPrimitives';

type ExternalApiDefinition = Extract<ApiDefinition, { readonly origin: 'external' }>;

interface ExternalApiEditCardProps {
  readonly api: ExternalApiDefinition;
  readonly onCancel: () => void;
  readonly onSaved: (apiId: string) => void;
}

/*** Render advanced settings for one selected canonical external API and persist edits without introducing a parallel model. */
export function ExternalApiEditCard({ api, onCancel, onSaved }: ExternalApiEditCardProps) {
  const studio = useStudio();
  const isManualRest = api.protocol === 'rest' && !api.openApi;
  const [url, setUrl] = useState(resolveExternalApiSourceUrl(api));
  const [name, setName] = useState(api.name ?? '');
  const [description, setDescription] = useState(api.description ?? '');
  const [protocol, setProtocol] = useState<ExternalApiProtocol>(resolveDiscoveryProtocol(api));
  const [credentialId, setCredentialId] = useState(api.credential?.id ?? '');
  const [credentialLabel, setCredentialLabel] = useState(api.credential?.label ?? '');
  const [credentialKind, setCredentialKind] = useState(api.credential?.kind ?? 'bearer');
  const [credentialScope, setCredentialScope] = useState(api.credential?.scope ?? '');
  const [diagnostics, setDiagnostics] = useState<readonly DataSourceDiagnostic[]>([]);
  const [message, setMessage] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  /*** Persist manual settings in place or rediscover an imported API under its existing canonical id. */
  const save = useCallback(async () => {
    if (busy) return;
    setBusy(true);
    setMessage(null);
    setDiagnostics([]);
    const credential = credentialId.trim()
      ? {
          id: credentialId.trim(),
          label: credentialLabel.trim() || undefined,
          kind: credentialKind.trim() || 'bearer',
          scope: credentialScope.trim() || undefined,
        }
      : undefined;

    try {
      const next = isManualRest
        ? await updateManualRestApi(studio.projectId, {
            apiId: api.id,
            baseUrl: url,
            name: name.trim() || undefined,
            description: description.trim() || undefined,
            credential,
          })
        : await connectExternalApi(studio.projectId, {
            apiId: api.id,
            url,
            protocol,
            name: name.trim() || undefined,
            description: description.trim() || undefined,
            credential,
          });
      setDiagnostics(next.diagnostics);
      if (next.ok) {
        await studio.refetchManifest();
        onSaved(next.apiId);
        return;
      }
      setMessage(next.diagnostics[0]?.message ?? 'API settings could not be updated.');
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'API settings could not be updated.');
    } finally {
      setBusy(false);
    }
  }, [
    api.id,
    busy,
    credentialId,
    credentialKind,
    credentialLabel,
    credentialScope,
    description,
    isManualRest,
    name,
    onSaved,
    protocol,
    studio,
    url,
  ]);

  return (
    <Card
      title={`Edit ${api.name ?? api.id}`}
      description="Advanced settings are shown only for the selected connected API. Imported endpoints and schemas remain canonical and read-only."
    >
      <View style={externalApiAdminStyles.stack}>
        <ExternalApiField label="Generated API ID">
          <Text selectable variant="bodySmall">
            {api.id}
          </Text>
        </ExternalApiField>
        <ExternalApiField label="Service or schema URL">
          <TextInput
            accessibilityLabel="Service or schema URL"
            value={url}
            autoCapitalize="none"
            autoCorrect={false}
            onChangeText={setUrl}
          />
        </ExternalApiField>
        <View style={externalApiAdminStyles.columns}>
          <ExternalApiField label="Display name (optional)">
            <TextInput accessibilityLabel="API display name" value={name} onChangeText={setName} />
          </ExternalApiField>
          <ExternalApiField label="Protocol discovery strategy">
            {isManualRest ? (
              <Text variant="bodySmall">Manual REST</Text>
            ) : (
              <Select
                value={protocol}
                options={PROTOCOL_OPTIONS}
                onValueChange={setProtocol}
              />
            )}
          </ExternalApiField>
        </View>
        <ExternalApiField label="Description (optional)">
          <TextInput
            accessibilityLabel="API description"
            value={description}
            multiline
            onChangeText={setDescription}
          />
        </ExternalApiField>
        <View style={externalApiAdminStyles.columns}>
          <ExternalApiField label="Credential secret ref (optional)">
            <TextInput
              accessibilityLabel="Credential secret reference"
              value={credentialId}
              autoCapitalize="none"
              autoCorrect={false}
              placeholder="services/example"
              onChangeText={setCredentialId}
            />
          </ExternalApiField>
          <ExternalApiField label="Credential label (optional)">
            <TextInput
              accessibilityLabel="Credential label"
              value={credentialLabel}
              onChangeText={setCredentialLabel}
            />
          </ExternalApiField>
          <ExternalApiField label="Credential kind">
            <TextInput
              accessibilityLabel="Credential kind"
              value={credentialKind}
              autoCapitalize="none"
              autoCorrect={false}
              onChangeText={setCredentialKind}
            />
          </ExternalApiField>
          <ExternalApiField label="Credential scope (optional)">
            <TextInput
              accessibilityLabel="Credential scope"
              value={credentialScope}
              autoCapitalize="none"
              autoCorrect={false}
              placeholder="header:x-api-key"
              onChangeText={setCredentialScope}
            />
          </ExternalApiField>
        </View>
        <Text color="neutral" emphasis="muted" variant="caption">
          Saving a discovered OpenAPI or GraphQL API runs discovery again under the same generated ID,
          so source URL, protocol, schemas, and operations stay consistent. Manual REST settings update
          in place and preserve authored operations.
        </Text>
        <ButtonGroup orientation="responsive" align="end">
          <Button variant="ghost" disabled={busy} onPress={onCancel}>
            Cancel
          </Button>
          <Button loading={busy} disabled={busy || !url.trim()} onPress={() => void save()}>
            Save changes
          </Button>
        </ButtonGroup>
        <View accessibilityLiveRegion="polite">
          {message ? <Text variant="bodySmall">{message}</Text> : null}
        </View>
        <ExternalApiDiagnosticList diagnostics={diagnostics} />
      </View>
    </Card>
  );
}

const PROTOCOL_OPTIONS: readonly { value: ExternalApiProtocol; label: string }[] = [
  { value: 'auto', label: 'Auto: OpenAPI, then GraphQL' },
  { value: 'openapi', label: 'OpenAPI' },
  { value: 'graphql', label: 'GraphQL introspection' },
];

/*** Resolve the editable source URL from an external API's protocol-specific canonical definition. */
function resolveExternalApiSourceUrl(api: ExternalApiDefinition): string {
  if (api.protocol === 'graphql') return api.endpointUrl;
  return api.openApi?.url ?? api.baseUrl;
}

/*** Resolve the initial discovery strategy represented by one imported external API definition. */
function resolveDiscoveryProtocol(api: ExternalApiDefinition): ExternalApiProtocol {
  if (api.protocol === 'graphql') return 'graphql';
  return api.openApi ? 'openapi' : 'auto';
}
