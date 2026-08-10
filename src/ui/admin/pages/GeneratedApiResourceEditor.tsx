import {
  GENERATED_API_CRUD_OPERATIONS,
  type GeneratedApiCrudOperation,
} from '@ankhorage/contracts';
import { Button, Input, Text } from '@ankhorage/zora';
import { View } from 'react-native';

import {
  createGeneratedApiFieldDraft,
  type GeneratedApiResourceDraft,
} from './generatedApiEditorModel';
import { generatedApiEditorStyles } from './generatedApiEditorStyles';
import { ExternalApiField } from './ExternalApiAdminPrimitives';
import { GeneratedApiFieldEditor } from './GeneratedApiFieldEditor';
import { GeneratedApiToggle } from './GeneratedApiToggle';

export function GeneratedApiResourceEditor({
  resource,
  canRemove,
  onChange,
  onRemove,
}: {
  readonly resource: GeneratedApiResourceDraft;
  readonly canRemove: boolean;
  readonly onChange: (resource: GeneratedApiResourceDraft) => void;
  readonly onRemove: () => void;
}) {
  const updateField = (index: number, field: GeneratedApiResourceDraft['fields'][number]) =>
    onChange({
      ...resource,
      fields: resource.fields.map((current, currentIndex) =>
        currentIndex === index ? field : current,
      ),
    });
  const removeField = (index: number) =>
    onChange({
      ...resource,
      fields: resource.fields.filter((_, currentIndex) => currentIndex !== index),
    });
  const toggleOperation = (operation: GeneratedApiCrudOperation, enabled: boolean) =>
    onChange({
      ...resource,
      operations: enabled
        ? [...resource.operations, operation]
        : resource.operations.filter((current) => current !== operation),
    });

  return (
    <View style={generatedApiEditorStyles.bordered}>
      <Text weight="semiBold">Resource</Text>
      <View style={generatedApiEditorStyles.columns}>
        <ExternalApiField label="Resource ID">
          <Input
            autoCapitalize="none"
            value={resource.id}
            onChangeText={(id) => onChange({ ...resource, id })}
          />
        </ExternalApiField>
        <ExternalApiField label="Path">
          <Input
            autoCapitalize="none"
            value={resource.path}
            onChangeText={(path) => onChange({ ...resource, path })}
          />
        </ExternalApiField>
        <ExternalApiField label="Table / collection">
          <Input
            autoCapitalize="none"
            value={resource.collectionName}
            onChangeText={(collectionName) => onChange({ ...resource, collectionName })}
          />
        </ExternalApiField>
        <ExternalApiField label="Schema">
          <Input
            autoCapitalize="none"
            value={resource.schema}
            onChangeText={(schema) => onChange({ ...resource, schema })}
          />
        </ExternalApiField>
        <ExternalApiField label="Primary key">
          <Input
            autoCapitalize="none"
            value={resource.primaryKey}
            onChangeText={(primaryKey) => onChange({ ...resource, primaryKey })}
          />
        </ExternalApiField>
      </View>
      <View style={generatedApiEditorStyles.columns}>
        <ExternalApiField label="Name">
          <Input value={resource.name} onChangeText={(name) => onChange({ ...resource, name })} />
        </ExternalApiField>
        <ExternalApiField label="Description">
          <Input
            value={resource.description}
            onChangeText={(description) => onChange({ ...resource, description })}
          />
        </ExternalApiField>
      </View>
      <Text variant="bodySmall" weight="semiBold">
        CRUD operations
      </Text>
      <View style={generatedApiEditorStyles.actions}>
        {GENERATED_API_CRUD_OPERATIONS.map((operation) => (
          <GeneratedApiToggle
            key={operation}
            label={operation}
            value={resource.operations.includes(operation)}
            onValueChange={(enabled) => toggleOperation(operation, enabled)}
          />
        ))}
      </View>
      <Text variant="bodySmall" weight="semiBold">
        Fields
      </Text>
      <View style={generatedApiEditorStyles.stack}>
        {resource.fields.map((field, index) => (
          <GeneratedApiFieldEditor
            key={`${index}:${field.name}`}
            field={field}
            onChange={(next) => updateField(index, next)}
            onRemove={() => removeField(index)}
          />
        ))}
        <Button
          variant="outline"
          onPress={() =>
            onChange({ ...resource, fields: [...resource.fields, createGeneratedApiFieldDraft()] })
          }
        >
          Add field
        </Button>
      </View>
      <ExternalApiField label="Starter / seed records (JSON array)">
        <Input
          multiline
          numberOfLines={6}
          autoCapitalize="none"
          value={resource.seedText}
          onChangeText={(seedText) => onChange({ ...resource, seedText })}
        />
      </ExternalApiField>
      {canRemove ? (
        <View style={generatedApiEditorStyles.actions}>
          <Button variant="outline" onPress={onRemove}>
            Remove resource
          </Button>
        </View>
      ) : null}
    </View>
  );
}
