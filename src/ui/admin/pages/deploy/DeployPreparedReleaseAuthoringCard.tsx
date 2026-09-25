import type { SerializableValue } from '@ankhorage/contracts';
import { Button, Card, Text } from '@ankhorage/zora';
import React, { useState } from 'react';

import { resolveContractsAuthoringStructure } from '../../../../features/authoring-engine/adapters/outbound/resolveContractsAuthoringStructure';
import { writeProjectDeployReleaseAuthoring } from '../../../../projectDeployApi';
import type { AuthoringStructureResolution } from '../../../../types/authoring-engine';
import { KeyValue } from '../../adminPagePrimitives';
import type { ProjectDeployDashboardState } from './deployDashboardTypes';
import { DeployOwnerAuthoringEditor } from './DeployOwnerAuthoringEditor';

/*** Author prepared Release desired state from the host-projected Deploy owner structure. */
export function DeployPreparedReleaseAuthoringCard(props: {
  readonly projectId: string;
  readonly authoring: ProjectDeployDashboardState['authoring'];
  readonly release: ProjectDeployDashboardState['release'];
  readonly onMutation: () => void;
}) {
  const owner =
    props.authoring.status === 'ready'
      ? {
          initial: props.authoring.data.release,
          structure: resolveContractsAuthoringStructure(
            props.authoring.data.structure,
            'prepared-release',
          ),
        }
      : null;

  return (
    <Card
      title="Prepared release desired state"
      description="Version, target membership, localized notes and rollout variants are derived from Deploy owner metadata. Execution remains inspect → confirm → execute."
    >
      {props.release.status === 'ready' ? (
        <KeyValue label="Prepared release revision" value={props.release.data.revision} />
      ) : null}
      {props.release.status === 'ready' && owner ? (
        <ReleaseDraftEditor
          key={props.release.data.revision}
          projectId={props.projectId}
          initial={owner.initial}
          structure={owner.structure}
          onMutation={props.onMutation}
        />
      ) : null}
      {props.authoring.status === 'loading' ? <Text>Loading authoring metadata…</Text> : null}
      {props.authoring.status === 'error' ? (
        <Text color="danger">{props.authoring.message}</Text>
      ) : null}
      {props.release.status === 'loading' ? <Text>Loading prepared release…</Text> : null}
      {props.release.status === 'error' ? (
        <Text color="danger">{props.release.message}</Text>
      ) : null}
    </Card>
  );
}

/*** Edit one revision-scoped Release draft and persist it through the trusted host owner projection. */
function ReleaseDraftEditor(props: {
  readonly projectId: string;
  readonly initial: SerializableValue;
  readonly structure: AuthoringStructureResolution;
  readonly onMutation: () => void;
}) {
  const [draft, setDraft] = useState(props.initial);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const save = async () => {
    setBusy(true);
    setError(null);
    try {
      await writeProjectDeployReleaseAuthoring(props.projectId, draft);
      props.onMutation();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : String(caught));
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <DeployOwnerAuthoringEditor
        structure={props.structure}
        value={draft}
        onChange={setDraft}
        onError={setError}
      />
      {error ? <Text color="danger">{error}</Text> : null}
      <Button disabled={busy} onPress={() => void save()}>
        {busy ? 'Saving…' : 'Save prepared release'}
      </Button>
    </>
  );
}
