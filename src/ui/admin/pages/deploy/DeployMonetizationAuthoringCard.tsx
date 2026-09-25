import {
  DEPLOY_AUTHORING_STRUCTURE,
  fromDeployMonetizationAuthoringValue,
  toDeployMonetizationAuthoringValue,
  type DeployMonetizationAuthoringValue,
} from '@ankhorage/deploy/authoring';
import { Button, Card, Text } from '@ankhorage/zora';
import React, { useState } from 'react';

import { resolveContractsAuthoringStructure } from '../../../../features/authoring-engine/adapters/outbound/resolveContractsAuthoringStructure';
import { writeProjectDeployMonetization } from '../../../../projectDeployApi';
import { KeyValue } from '../../adminPagePrimitives';
import type { ProjectDeployDashboardState } from './deployDashboardTypes';
import { DeployOwnerAuthoringEditor } from './DeployOwnerAuthoringEditor';

const MONETIZATION_STRUCTURE = resolveContractsAuthoringStructure(
  DEPLOY_AUTHORING_STRUCTURE,
  'monetization',
);

/*** Author Monetization desired state from the released Deploy owner structure and canonical projections. */
export function DeployMonetizationAuthoringCard(props: {
  readonly projectId: string;
  readonly monetization: ProjectDeployDashboardState['monetization'];
  readonly onMutation: () => void;
}) {
  return (
    <Card
      title="Monetization desired state"
      description="Product identity, variants, pricing, localization and subscriptions are derived from Deploy's released owner metadata."
    >
      {props.monetization.status === 'ready' ? (
        <>
          <KeyValue label="Monetization revision" value={props.monetization.data.revision} />
          <MonetizationDraftEditor
            key={props.monetization.data.revision}
            projectId={props.projectId}
            initial={toDeployMonetizationAuthoringValue(props.monetization.data.products)}
            onMutation={props.onMutation}
          />
        </>
      ) : null}
      {props.monetization.status === 'loading' ? <Text>Loading monetization…</Text> : null}
      {props.monetization.status === 'error' ? (
        <Text color="danger">{props.monetization.message}</Text>
      ) : null}
    </Card>
  );
}

/*** Edit one revision-scoped Monetization draft and persist it through Deploy's canonical projection. */
function MonetizationDraftEditor(props: {
  readonly projectId: string;
  readonly initial: DeployMonetizationAuthoringValue;
  readonly onMutation: () => void;
}) {
  const [draft, setDraft] = useState(props.initial);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  /*** Persist the current Monetization authoring value through Deploy's canonical reverse projection. */
  const save = async () => {
    setBusy(true);
    setError(null);
    try {
      await writeProjectDeployMonetization(
        props.projectId,
        fromDeployMonetizationAuthoringValue(draft),
      );
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
        structure={MONETIZATION_STRUCTURE}
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
