import type { UiNode } from '@ankhorage/contracts';
import { Card, Text } from '@ankhorage/zora';
import React from 'react';

import { useStudio } from '../../../core/StudioContext';
import {
  AuthoringEditor,
  type AuthoringCustomControlProps,
} from '../../../features/authoring-engine/adapters/inbound/AuthoringEditor';
import { resolveInstancePropertyAuthoring } from '../../../features/authoring-engine/adapters/outbound/resolveInstancePropertyAuthoring';
import { deriveAuthoringModel } from '../../../features/authoring-engine/application/use-cases/deriveAuthoringModel';
import { findNodeInManifest, findScreenIdForNode } from '../../../manifestState';
import { readStudioMediaAssetReference } from '../../../mediaAuthoringModel';
import {
  createStudioInstancePropertyPatch,
  type StudioInstancePropertyValue,
} from '../../../propertiesAuthoringModel';
import type { AuthoringMutation, AuthoringValue } from '../../../types/authoring-engine';
import { AdminHeader, AdminScroll, KeyValue } from '../adminPagePrimitives';
import { MediaPropertyInput } from './MediaPropertyInput';

/***
 * Resolve the requested manifest node, synchronize Studio selection context, and render its per-instance property authoring.
 */
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

/*** Render identity plus owner-derived instance-property groups through the central Authoring Editor. */
function ResolvedProperties({ node }: { readonly node: UiNode }) {
  const studio = useStudio();
  const authoring = resolveInstancePropertyAuthoring(node, studio.bindableComponentMeta);

  /*** Apply one neutral field mutation through Studio's canonical node update and autosave boundary. */
  const applyMutation = (mutation: AuthoringMutation) => {
    const [propertyName] = mutation.path;
    if (!propertyName || mutation.path.length !== 1) return;
    const value =
      mutation.kind === 'unset' ? undefined : resolveInstancePropertyValue(mutation.value);
    if (mutation.kind === 'set' && value === undefined) return;
    studio.updateNode(node.id, createStudioInstancePropertyPatch(node, propertyName, value));
  };

  /*** Render owner-requested media authoring without moving media policy into the neutral engine. */
  const renderCustomControl = ({ model, onMutation }: AuthoringCustomControlProps) => {
    const [propertyName] = model.path;
    if (
      model.editor?.kind !== 'media' ||
      !studio.manifest ||
      !propertyName ||
      model.path.length !== 1
    ) {
      return undefined;
    }

    return (
      <MediaPropertyInput
        value={node.props?.[propertyName]}
        mediaKinds={model.editor.mediaKinds}
        manifest={studio.manifest}
        onChange={(reference) =>
          onMutation(
            reference
              ? { kind: 'set', path: model.path, value: { mediaId: reference.mediaId } }
              : { kind: 'unset', path: model.path },
          )
        }
      />
    );
  };

  return (
    <>
      <Card title={authoring.componentName}>
        <KeyValue label="Node ID" value={node.id} />
        <KeyValue label="Type" value={node.type} />
        {node.alias ? <KeyValue label="Alias" value={node.alias} /> : null}
      </Card>
      {authoring.groups.map((group) => (
        <Card key={group.category} title={group.category}>
          <AuthoringEditor
            model={deriveAuthoringModel({
              structure: group.structure,
              policy: group.policy,
              value: node.props ?? {},
              label: group.category,
            })}
            onMutation={applyMutation}
            renderCustomControl={renderCustomControl}
          />
        </Card>
      ))}
      {authoring.groups.length === 0 ? <NoInstanceProperties /> : null}
      <Text color="neutral" emphasis="muted" variant="bodySmall">
        Visual design properties are theme-owned and intentionally unavailable as per-instance
        overrides.
      </Text>
    </>
  );
}

/*** Accept only canonical instance-property values emitted by supported generic or media editors. */
function resolveInstancePropertyValue(
  value: AuthoringValue,
): StudioInstancePropertyValue | undefined {
  if (typeof value === 'string' || typeof value === 'boolean') return value;
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  return readStudioMediaAssetReference(value) ?? undefined;
}

/*** Render the properties-page fallback when the requested node cannot be resolved. */
function UnavailableNode() {
  return (
    <Card title="Node unavailable">
      <Text color="neutral" emphasis="muted">
        The requested node could not be resolved in the current project manifest.
      </Text>
    </Card>
  );
}

/*** Render the properties-page fallback when the component exposes no per-instance authoring fields. */
function NoInstanceProperties() {
  return (
    <Card title="No instance properties">
      <Text color="neutral" emphasis="muted">
        This component exposes no properties for per-instance authoring.
      </Text>
    </Card>
  );
}
