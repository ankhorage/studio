import {
  DEPLOY_AUTHORING_STRUCTURE,
  fromDeployReleaseAuthoringValue,
  toDeployReleaseAuthoringValue,
  type DeployReleaseAuthoringValue,
} from '@ankhorage/deploy/authoring';
import { Button, Card, Text } from '@ankhorage/zora';
import React, { useState } from 'react';

import { resolveContractsAuthoringStructure } from '../../../../features/authoring-engine/adapters/outbound/resolveContractsAuthoringStructure';
import { writeProjectDeployRelease } from '../../../../projectDeployApi';
import { KeyValue } from '../../adminPagePrimitives';
import type { ProjectDeployDashboardState } from './deployDashboardTypes';
import { DeployOwnerAuthoringEditor } from './DeployOwnerAuthoringEditor';

const RELEASE_STRUCTURE = resolveContractsAuthoringStructure(
  DEPLOY_AUTHORING_STRUCTURE,
  'prepared-release',
);

/*** Author prepared Release desired state through Deploy's released structure and canonical projections. */
export function DeployPreparedReleaseAuthoringCard(props: {
  readonly projectId: string;
  readonly release: ProjectDeployDashboardState['release'];
  readonly onMutation: () => void;
}) {
  return (
    <Card
      title="Prepared release desired state"
      description="Version, target membership, localized notes and rollout variants are derived from Deploy owner metadata. Execution remains inspect → confirm → execute."
    >
      {props.release.status === 'ready' ? (
        <>
          <KeyValue label="Prepared release revision" value={props.release.data.revision} />
          <ReleaseDraftEditor
            key={props.release.data.revision}
            projectId={props.projectId}
            initial={toDeployReleaseAuthoringValue({
              version: props.release.data.version,
              targets: props.release.data.targets,
              notes: props.release.data.notes,
              rollout: props.release.data.rollout,
            })}
            onMutation={props.onMutation}
          />
        </>
      ) : null}
      {props.release.status === 'loading' ? <Text>Loading prepared release…</Text> : null}
      {props.release.status === 'error' ? (
        <Text color="danger">{props.release.message}</Text>
      ) : null}
    </Card>
  );
}

/*** Edit one revision-scoped Release draft and persist it through Deploy's canonical projection. */
function ReleaseDraftEditor(props: {
  readonly projectId: string;
  readonly initial: DeployReleaseAuthoringValue;
  readonly onMutation: () => void;
}) {
  const [draft, setDraft] = useState(props.initial);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  /*** Persist the current Release authoring value through Deploy's canonical reverse projection. */
  const save = async () => {
    setBusy(true);
    setError(null);
    try {
      await writeProjectDeployRelease(props.projectId, fromDeployReleaseAuthoringValue(draft));
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
        structure={RELEASE_STRUCTURE}
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
