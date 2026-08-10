import type { GeneratedApiDefinition } from '@ankhorage/contracts';
import { Button, Input } from '@ankhorage/zora';
import { useMemo } from 'react';
import { View } from 'react-native';

import type { GeneratedApiEditorDraft } from './generatedApiEditorModel';
import {
  createGeneratedApiResourceDraft,
  resolveGeneratedApiEditorDraft,
} from './generatedApiEditorModel';
import { generatedApiEditorStyles } from './generatedApiEditorStyles';
import { ExternalApiDiagnosticList, ExternalApiField } from './ExternalApiAdminPrimitives';
import { GeneratedApiNormalizedOperations } from './GeneratedApiNormalizedOperations';
import { GeneratedApiResourceEditor } from './GeneratedApiResourceEditor';

export function GeneratedApiEditor({
  draft,
  onChange,
  onCancel,
  onSave,
}: {
  readonly draft: GeneratedApiEditorDraft;
  readonly onChange: (draft: GeneratedApiEditorDraft) => void;
  readonly onCancel: () => void;
  readonly onSave: (definition: GeneratedApiDefinition, previousId?: string) => void;
}) {
  const resolution = useMemo(() => resolveGeneratedApiEditorDraft(draft), [draft]);
  const hasErrors = resolution.diagnostics.some((entry) => entry.severity === 'error');
  const updateResource = (index: number, resource: GeneratedApiEditorDraft['resources'][number]) =>
    onChange({
      ...draft,
      resources: draft.resources.map((current, currentIndex) =>
        currentIndex === index ? resource : current,
      ),
    });

  return (
    <View style={generatedApiEditorStyles.stack}>
      <View style={generatedApiEditorStyles.columns}>
        <ExternalApiField label="API ID">
          <Input
            autoCapitalize="none"
            value={draft.id}
            onChangeText={(id) => onChange({ ...draft, id })}
          />
        </ExternalApiField>
        <ExternalApiField label="Base path">
          <Input
            autoCapitalize="none"
            value={draft.basePath}
            onChangeText={(basePath) => onChange({ ...draft, basePath })}
          />
        </ExternalApiField>
        <ExternalApiField label="Database adapter ID">
          <Input
            autoCapitalize="none"
            value={draft.databaseAdapterId}
            onChangeText={(databaseAdapterId) => onChange({ ...draft, databaseAdapterId })}
          />
        </ExternalApiField>
      </View>
      <View style={generatedApiEditorStyles.columns}>
        <ExternalApiField label="Name">
          <Input value={draft.name} onChangeText={(name) => onChange({ ...draft, name })} />
        </ExternalApiField>
        <ExternalApiField label="Description">
          <Input
            value={draft.description}
            onChangeText={(description) => onChange({ ...draft, description })}
          />
        </ExternalApiField>
      </View>
      {draft.resources.map((resource, index) => (
        <GeneratedApiResourceEditor
          key={`${index}:${resource.id}`}
          resource={resource}
          canRemove={draft.resources.length > 1}
          onChange={(next) => updateResource(index, next)}
          onRemove={() =>
            onChange({
              ...draft,
              resources: draft.resources.filter((_, currentIndex) => currentIndex !== index),
            })
          }
        />
      ))}
      <Button
        variant="outline"
        onPress={() =>
          onChange({
            ...draft,
            resources: [
              ...draft.resources,
              createGeneratedApiResourceDraft(draft.resources.length),
            ],
          })
        }
      >
        Add resource
      </Button>
      <ExternalApiDiagnosticList diagnostics={resolution.diagnostics} />
      <GeneratedApiNormalizedOperations dataSource={resolution.dataSource} />
      <View style={generatedApiEditorStyles.actions}>
        <Button variant="outline" onPress={onCancel}>
          Cancel
        </Button>
        <Button
          disabled={hasErrors || !resolution.definition}
          onPress={() => {
            if (resolution.definition) onSave(resolution.definition, draft.originalId);
          }}
        >
          Save generated API
        </Button>
      </View>
    </View>
  );
}
