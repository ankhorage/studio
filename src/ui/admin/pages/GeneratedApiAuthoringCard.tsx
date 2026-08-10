import type { DataSourceDiagnostic, GeneratedApiDefinition } from '@ankhorage/contracts';
import { Button, Card, Text } from '@ankhorage/zora';
import { useState } from 'react';
import { View } from 'react-native';

import { useStudio } from '../../../core/StudioContext';
import {
  createGeneratedApiEditorDraft,
  type GeneratedApiEditorDraft,
} from './generatedApiEditorModel';
import { generatedApiEditorStyles } from './generatedApiEditorStyles';
import { ExternalApiDiagnosticList } from './ExternalApiAdminPrimitives';
import { GeneratedApiEditor } from './GeneratedApiEditor';

export function GeneratedApiAuthoringCard() {
  const studio = useStudio();
  const definitions = Object.values(studio.manifest?.generatedApis ?? {});
  const [draft, setDraft] = useState<GeneratedApiEditorDraft | null>(null);
  const [diagnostics, setDiagnostics] = useState<readonly DataSourceDiagnostic[]>([]);
  const [message, setMessage] = useState<string | null>(null);

  const edit = (definition?: GeneratedApiDefinition) => {
    setDiagnostics([]);
    setMessage(null);
    setDraft(createGeneratedApiEditorDraft(definition));
  };
  const save = (definition: GeneratedApiDefinition, previousId?: string) => {
    const nextDiagnostics = studio.upsertGeneratedApi(definition, previousId);
    setDiagnostics(nextDiagnostics);
    if (nextDiagnostics.some((entry) => entry.severity === 'error')) return;
    setMessage(`${previousId ? 'Updated' : 'Created'} generated API ${definition.id}.`);
    setDraft(null);
  };

  return (
    <Card title="Create generated API">
      <View style={generatedApiEditorStyles.stack}>
        <Text color="neutral" emphasis="muted" variant="bodySmall">
          Author REST/CRUD desired state. Data Sources owns operation normalization; Infra owns
          database migrations.
        </Text>
        {definitions.map((definition) => (
          <View key={definition.id} style={generatedApiEditorStyles.bordered}>
            <Text weight="semiBold">{definition.name ?? definition.id}</Text>
            <Text color="neutral" variant="caption">
              {definition.id} · {definition.basePath} · {definition.resources.length} resource(s)
            </Text>
            <View style={generatedApiEditorStyles.actions}>
              <Button variant="outline" onPress={() => edit(definition)}>
                Edit
              </Button>
              <Button
                variant="outline"
                onPress={() => {
                  studio.deleteGeneratedApi(definition.id);
                  setMessage(`Deleted generated API ${definition.id}.`);
                  if (draft?.originalId === definition.id) setDraft(null);
                }}
              >
                Delete
              </Button>
            </View>
          </View>
        ))}
        {draft ? (
          <GeneratedApiEditor
            draft={draft}
            onChange={setDraft}
            onCancel={() => setDraft(null)}
            onSave={save}
          />
        ) : (
          <Button onPress={() => edit()}>Create generated API</Button>
        )}
        {message ? <Text variant="bodySmall">{message}</Text> : null}
        <ExternalApiDiagnosticList diagnostics={diagnostics} />
      </View>
    </Card>
  );
}
