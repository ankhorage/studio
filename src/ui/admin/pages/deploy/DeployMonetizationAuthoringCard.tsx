import type { MonetizationProduct } from '@ankhorage/deploy';
import { Button, Card, Text } from '@ankhorage/zora';
import React, { useEffect, useState } from 'react';

import { writeProjectDeployMonetization } from '../../../../projectDeployApi';
import { Field, Input, KeyValue } from '../../adminPagePrimitives';
import type { ProjectDeployDashboardState } from './deployDashboardTypes';

export function DeployMonetizationAuthoringCard(props: {
  readonly projectId: string;
  readonly monetization: ProjectDeployDashboardState['monetization'];
  readonly onMutation: () => void;
}) {
  const [source, setSource] = useState('[]');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (props.monetization.status !== 'ready') return;
    setSource(JSON.stringify(props.monetization.data.products, null, 2));
  }, [props.monetization]);

  const save = async () => {
    setBusy(true);
    setError(null);
    try {
      const parsed: unknown = JSON.parse(source);
      if (!Array.isArray(parsed))
        throw new Error('Canonical Deploy products must be a JSON array.');
      await writeProjectDeployMonetization(
        props.projectId,
        parsed as readonly MonetizationProduct[],
      );
      props.onMutation();
    } catch (caught) {
      setError(readError(caught));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Card
      title="Monetization desired state"
      description="Edit the exact canonical Deploy product array. Deploy owns product, pricing, subscription validation and persistence."
    >
      {props.monetization.status === 'ready' ? (
        <KeyValue label="Monetization revision" value={props.monetization.data.revision} />
      ) : null}
      <Field label="Canonical MonetizationProduct[]">
        <Input multiline numberOfLines={14} value={source} onChangeText={setSource} />
      </Field>
      {props.monetization.status === 'loading' ? <Text>Loading monetization…</Text> : null}
      {props.monetization.status === 'error' ? (
        <Text color="danger">{props.monetization.message}</Text>
      ) : null}
      {error ? <Text color="danger">{error}</Text> : null}
      <Button disabled={busy} onPress={() => void save()}>
        {busy ? 'Saving…' : 'Save monetization desired state'}
      </Button>
    </Card>
  );
}

function readError(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
