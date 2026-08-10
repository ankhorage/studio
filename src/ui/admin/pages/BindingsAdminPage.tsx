import { Card, Text, ZORA_BINDABLE_COMPONENT_META } from '@ankhorage/zora';
import React from 'react';

import {
  collectStudioBindingOperationOptions,
  diagnoseStudioComponentBindings,
} from '../../../bindingAuthoringModel';
import { useStudio } from '../../../core/StudioContext';
import { ACTION_REGISTRY } from '../../../index';
import { findNodeInManifest, findScreenIdForNode } from '../../../manifestState';
import { AdminHeader, AdminScroll, KeyValue } from '../adminPagePrimitives';
import { BindingDiagnosticsCard } from './bindings/BindingDiagnosticsCard';
import { EventBindingsCard } from './bindings/EventBindingsCard';
import { PropertyBindingsCard } from './bindings/PropertyBindingsCard';

export function BindingsAdminPage({ nodeId }: { readonly nodeId: string | null }) {
  const studio = useStudio();
  const owningScreenId =
    nodeId && studio.manifest ? findScreenIdForNode(studio.manifest, nodeId) : null;
  const owningRoot = owningScreenId ? studio.manifest?.screens[owningScreenId]?.root : null;
  const node = owningRoot && nodeId ? findNodeInManifest(owningRoot, nodeId) : null;

  React.useEffect(() => {
    if (!nodeId || !node || !owningScreenId) return;
    studio.setActiveScreenId(owningScreenId);
    studio.selectNode(nodeId);
  }, [node, nodeId, owningScreenId, studio]);

  if (!node || !studio.manifest) {
    return (
      <AdminScroll>
        <AdminHeader
          title="Bindings"
          description="Author canonical property/data and event/action bindings for a selected component."
        />
        <Card title="Node unavailable">
          <Text color="neutral" emphasis="muted">
            The requested node could not be resolved in the current project manifest.
          </Text>
        </Card>
      </AdminScroll>
    );
  }

  const registry = studio.manifest.dataBindings ?? {};
  const operations = collectStudioBindingOperationOptions(studio.manifest.dataSources ?? {});
  const diagnostics = diagnoseStudioComponentBindings({
    node,
    registry,
    componentMeta: ZORA_BINDABLE_COMPONENT_META,
    dataSources: studio.manifest.dataSources ?? {},
    operations,
    actionTypes: Object.keys(ACTION_REGISTRY),
  });

  return (
    <AdminScroll>
      <AdminHeader
        title="Bindings"
        description="Bind component data and events through canonical manifest contracts. Studio authors; Runtime executes."
      />
      <Card title={ZORA_BINDABLE_COMPONENT_META[node.type]?.name ?? node.type}>
        <KeyValue label="Node ID" value={node.id} />
        <KeyValue label="Type" value={node.type} />
        {node.alias ? <KeyValue label="Alias" value={node.alias} /> : null}
      </Card>
      <PropertyBindingsCard
        node={node}
        registry={registry}
        operations={operations}
        onChange={studio.updateDataBindings}
      />
      <EventBindingsCard
        node={node}
        registry={registry}
        operations={operations}
        onChange={studio.updateDataBindings}
      />
      <BindingDiagnosticsCard diagnostics={diagnostics} />
    </AdminScroll>
  );
}
