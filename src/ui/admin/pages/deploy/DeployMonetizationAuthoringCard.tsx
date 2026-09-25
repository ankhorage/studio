import type { SerializableValue } from '@ankhorage/contracts';
import { Button, Card, Text } from '@ankhorage/zora';
import React, { useState } from 'react';

import { resolveContractsAuthoringStructure } from '../../../../features/authoring-engine/adapters/outbound/resolveContractsAuthoringStructure';
import { writeProjectDeployMonetizationAuthoring } from '../../../../projectDeployApi';
import type { AuthoringStructureResolution } from '../../../../types/authoring-engine';
import { KeyValue } from '../../adminPagePrimitives';
import type { ProjectDeployDashboardState } from './deployDashboardTypes';
import { DeployOwnerAuthoringEditor } from './DeployOwnerAuthoringEditor';

/*** Author Monetization desired state from the host-projected Deploy owner structure. */
export function DeployMonetizationAuthoringCard(props: {
  readonly projectId: string;
  readonly authoring: ProjectDeployDashboardState['authoring'];
  readonly monetization: ProjectDeployDashboardState['monetization'];
  readonly onMutation: () => void;
}) {
  const owner =
    props.authoring.status === 'ready'
      ? {
          initial: props.authoring.data.monetization,
          structure: resolveContractsAuthoringStructure(
            props.authoring.data.structure,
            'monetization',
          ),
        }
      : null;

  return (
    <Card
      title="Monetization desired state"
      description="Product identity, variants, pricing, localization and subscriptions are derived from Deploy's released owner metadata."
    >
      {props.monetization.status === 'ready' ? (
        <KeyValue label="Monetization revision" value={props.monetization.data.revision} />
      ) : null}
      {props.monetization.status === 'ready' && owner ? (
        <MonetizationDraftEditor
          key={props.monetization.data.revision}
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
      {props.monetization.status === 'loading' ? <Text>Loading monetization…</Text> : null}
      {props.monetization.status === 'error' ? (
        <Text color="danger">{props.monetization.message}</Text>
      ) : null}
    </Card>
  );
}

/*** Edit one revision-scoped Monetization draft and persist it through the trusted host owner projection. */
function MonetizationDraftEditor(props: {
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
      await writeProjectDeployMonetizationAuthoring(props.projectId, draft);
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
        {busy ? 'Saving…' : 'Save monetization desired state'}
      </Button>
    </>
  );
}
