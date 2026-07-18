import type { UiNode } from '@ankhorage/contracts';
import { Card, Text } from '@ankhorage/zora';
import React from 'react';

import { useStudio } from '../../../core/StudioContext';
import { findNodeInManifest, findScreenIdForNode } from '../../../manifestState';
import { AdminHeader, AdminScroll, Field, Input, KeyValue } from '../adminPagePrimitives';
import { formatPrimitive } from '../adminPageUtils';

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
        description="Contextual properties for the selected Studio node."
      />
      {node ? (
        <Card title={node.alias ?? node.type}>
          <KeyValue label="Node ID" value={node.id} />
          <KeyValue label="Type" value={node.type} />
          <Field label="Alias">
            <Input
              value={node.alias ?? ''}
              onChangeText={(alias) => studio.updateNode(node.id, { alias })}
            />
          </Field>
          <NodeProps node={node} />
        </Card>
      ) : (
        <Card title="Node unavailable">
          <Text color="neutral" emphasis="muted">
            The requested node could not be resolved in the active Studio screen.
          </Text>
        </Card>
      )}
    </AdminScroll>
  );
}

function NodeProps({ node }: { readonly node: UiNode }) {
  const entries = Object.entries(node.props ?? {});
  if (entries.length === 0) {
    return (
      <Text color="neutral" emphasis="muted">
        This node has no editable primitive props.
      </Text>
    );
  }

  return (
    <>
      {entries.map(([key, value]) => (
        <KeyValue key={key} label={key} value={formatPrimitive(value)} />
      ))}
    </>
  );
}
