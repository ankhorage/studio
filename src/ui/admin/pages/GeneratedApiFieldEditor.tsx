import type { DbFieldType } from '@ankhorage/contracts';
import { Button, Input, Select } from '@ankhorage/zora';
import { View } from 'react-native';

import type { GeneratedApiFieldDraft } from './generatedApiEditorModel';
import { generatedApiEditorStyles } from './generatedApiEditorStyles';
import { ExternalApiField } from './ExternalApiAdminPrimitives';
import { GeneratedApiToggle } from './GeneratedApiToggle';

const TYPE_OPTIONS: readonly { value: DbFieldType; label: string }[] = [
  { value: 'uuid', label: 'UUID' },
  { value: 'text', label: 'Text' },
  { value: 'number', label: 'Number' },
  { value: 'boolean', label: 'Boolean' },
  { value: 'datetime', label: 'Datetime' },
  { value: 'json', label: 'JSON' },
];

export function GeneratedApiFieldEditor({
  field,
  onChange,
  onRemove,
}: {
  readonly field: GeneratedApiFieldDraft;
  readonly onChange: (field: GeneratedApiFieldDraft) => void;
  readonly onRemove: () => void;
}) {
  return (
    <View style={generatedApiEditorStyles.bordered}>
      <View style={generatedApiEditorStyles.columns}>
        <ExternalApiField label="Field name">
          <Input
            autoCapitalize="none"
            value={field.name}
            onChangeText={(name) => onChange({ ...field, name })}
          />
        </ExternalApiField>
        <ExternalApiField label="Type">
          <Select
            value={field.type}
            options={TYPE_OPTIONS}
            onValueChange={(type) => onChange({ ...field, type })}
          />
        </ExternalApiField>
        <ExternalApiField label="Default">
          <Input
            value={field.defaultValueText}
            onChangeText={(defaultValueText) => onChange({ ...field, defaultValueText })}
          />
        </ExternalApiField>
      </View>
      <View style={generatedApiEditorStyles.actions}>
        <GeneratedApiToggle
          label="Required"
          value={field.required}
          onValueChange={(required) => onChange({ ...field, required })}
        />
        <GeneratedApiToggle
          label="Unique"
          value={field.unique}
          onValueChange={(unique) => onChange({ ...field, unique })}
        />
        <Button variant="outline" onPress={onRemove}>
          Remove field
        </Button>
      </View>
    </View>
  );
}
