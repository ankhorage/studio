import type { UiNode } from '@ankhorage/contracts';
import { Card, Text, ZORA_COMPONENT_META } from '@ankhorage/zora';
import React from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { useStudio } from '../../../core/StudioContext';
import { findNodeInManifest, findScreenIdForNode } from '../../../manifestState';
import {
  createStudioInstancePropertyPatch,
  resolveStudioInstancePropertyGroups,
  type StudioInstancePropertyField,
  type StudioInstancePropertyValue,
} from '../../../propertiesAuthoringModel';
import { AdminHeader, AdminScroll, Field, Input, KeyValue } from '../adminPagePrimitives';

export function PropertiesAdminPage({ nodeId }: { readonly nodeId: string | null }) {
  const studio = useStudio();
  const owningScreenId =
    nodeId && studio.manifest ? findScreenIdForNode(studio.manifest, nodeId) : null;
  const owningRoot = owningScreenId ? studio.manifest?.screens[owningScreenId]?.root : null;
  const node = owningRoot && nodeId ? findNodeInManifest(owningRoot, nodeId) : null;

  React.useEffect(() => {
    if (nodeId && node && owningScreenId) {
      studio.setActiveScreenId(owningScreenId);
      studio.selectNode(nodeId);
    }
  }, [node, nodeId, owningScreenId, studio]);

  return (
    <AdminScroll>
      <AdminHeader
        title="Properties"
        description="Edit only the content and behavior explicitly owned by this component instance."
      />
      {node ? <ResolvedProperties node={node} /> : <UnavailableNode />}
    </AdminScroll>
  );
}

function ResolvedProperties({ node }: { readonly node: UiNode }) {
  const studio = useStudio();
  const componentMeta = new Map(Object.entries(ZORA_COMPONENT_META)).get(node.type);
  const groups = resolveStudioInstancePropertyGroups(node, ZORA_COMPONENT_META);
  const updateProperty = (propertyName: string, value: StudioInstancePropertyValue | undefined) => {
    studio.updateNode(node.id, createStudioInstancePropertyPatch(node, propertyName, value));
  };

  return (
    <>
      <Card title={componentMeta?.name ?? node.type}>
        <KeyValue label="Node ID" value={node.id} />
        <KeyValue label="Type" value={node.type} />
        {node.alias ? <KeyValue label="Alias" value={node.alias} /> : null}
      </Card>
      {groups.map((group) => (
        <Card key={group.category} title={group.category}>
          <View style={styles.fieldStack}>
            {group.fields.map((field) => (
              <InstancePropertyEditor
                key={field.name}
                field={field}
                onChange={(value) => updateProperty(field.name, value)}
              />
            ))}
          </View>
        </Card>
      ))}
      {groups.length === 0 ? <NoInstanceProperties /> : null}
      <Text color="neutral" emphasis="muted" variant="bodySmall">
        Visual design properties are theme-owned and intentionally unavailable as per-instance
        overrides.
      </Text>
    </>
  );
}

function InstancePropertyEditor(props: {
  readonly field: StudioInstancePropertyField;
  readonly onChange: (value: StudioInstancePropertyValue | undefined) => void;
}) {
  const { field, onChange } = props;

  return (
    <Field label={field.label}>
      {field.editor === 'text' ? (
        <Input value={toInputText(field.value)} onChangeText={onChange} />
      ) : null}
      {field.editor === 'number' ? <NumberPropertyInput field={field} onChange={onChange} /> : null}
      {field.editor === 'boolean' ? (
        <BooleanPropertyInput field={field} onChange={onChange} />
      ) : null}
      {field.editor === 'choice' ? <ChoicePropertyInput field={field} onChange={onChange} /> : null}
      {field.editor === 'unsupported' ? (
        <Text color="neutral" emphasis="muted" variant="bodySmall">
          This instance property requires a dedicated editor that is not available yet.
        </Text>
      ) : null}
    </Field>
  );
}

function NumberPropertyInput(props: {
  readonly field: StudioInstancePropertyField;
  readonly onChange: (value: number | undefined) => void;
}) {
  const { field, onChange } = props;
  const [draft, setDraft] = React.useState(toInputText(field.value));
  const [error, setError] = React.useState<string | null>(null);

  React.useEffect(() => {
    setDraft(toInputText(field.value));
    setError(null);
  }, [field.name, field.value]);

  const commit = () => {
    const normalized = draft.trim();
    if (!normalized) {
      setError(null);
      onChange(undefined);
      return;
    }

    const value = Number(normalized);
    if (!Number.isFinite(value)) {
      setError('Enter a valid number.');
      return;
    }

    setError(null);
    onChange(value);
  };

  return (
    <>
      <Input
        value={draft}
        keyboardType="numeric"
        onChangeText={setDraft}
        onBlur={commit}
        onSubmitEditing={commit}
      />
      {error ? (
        <Text color="danger" variant="bodySmall">
          {error}
        </Text>
      ) : null}
    </>
  );
}

function BooleanPropertyInput(props: {
  readonly field: StudioInstancePropertyField;
  readonly onChange: (value: boolean) => void;
}) {
  const { field, onChange } = props;
  const checked = field.value === true;

  return (
    <Pressable
      accessibilityRole="switch"
      accessibilityState={{ checked }}
      onPress={() => onChange(!checked)}
      style={[styles.toggle, checked ? styles.choiceSelected : null]}
    >
      <Text weight="semiBold">{checked ? 'On' : 'Off'}</Text>
    </Pressable>
  );
}

function ChoicePropertyInput(props: {
  readonly field: StudioInstancePropertyField;
  readonly onChange: (value: string | number) => void;
}) {
  const { field, onChange } = props;

  return (
    <View style={styles.choiceRow}>
      {field.options.map((option) => {
        const selected = field.value === option;
        return (
          <Pressable
            key={`${field.name}:${String(option)}`}
            accessibilityRole="radio"
            accessibilityState={{ checked: selected }}
            onPress={() => onChange(option)}
            style={[styles.choice, selected ? styles.choiceSelected : null]}
          >
            <Text weight={selected ? 'semiBold' : 'regular'}>{String(option)}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

function UnavailableNode() {
  return (
    <Card title="Node unavailable">
      <Text color="neutral" emphasis="muted">
        The requested node could not be resolved in the current project manifest.
      </Text>
    </Card>
  );
}

function NoInstanceProperties() {
  return (
    <Card title="No instance properties">
      <Text color="neutral" emphasis="muted">
        This component exposes no properties for per-instance authoring.
      </Text>
    </Card>
  );
}

function toInputText(value: unknown): string {
  return typeof value === 'string' || typeof value === 'number' ? String(value) : '';
}

const styles = StyleSheet.create({
  fieldStack: {
    gap: 14,
  },
  choiceRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  choice: {
    minHeight: 40,
    justifyContent: 'center',
    borderWidth: 1,
    borderRadius: 8,
    borderColor: 'transparent',
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  choiceSelected: {
    borderColor: '#4f46e5',
  },
  toggle: {
    minHeight: 44,
    alignSelf: 'flex-start',
    justifyContent: 'center',
    borderWidth: 1,
    borderRadius: 8,
    borderColor: 'transparent',
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
});
