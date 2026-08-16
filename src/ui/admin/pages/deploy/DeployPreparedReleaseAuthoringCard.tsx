import type { ProjectReleaseInput } from '@ankhorage/deploy/project';
import { Button, Card, Text } from '@ankhorage/zora';
import React, { useEffect, useState } from 'react';

import { writeProjectDeployRelease } from '../../../../projectDeployApi';
import { Field, Input, KeyValue } from '../../adminPagePrimitives';
import type { ProjectDeployDashboardState } from './deployDashboardTypes';

export function DeployPreparedReleaseAuthoringCard(props: {
  readonly projectId: string;
  readonly release: ProjectDeployDashboardState['release'];
  readonly onMutation: () => void;
}) {
  const [source, setSource] = useState('{}');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (props.release.status !== 'ready') return;
    const release: ProjectReleaseInput = {
      version: props.release.data.version,
      targets: props.release.data.targets,
      notes: props.release.data.notes,
      rollout: props.release.data.rollout,
    };
    setSource(JSON.stringify(release, null, 2));
  }, [props.release]);

  const save = async () => {
    setBusy(true);
    setError(null);
    try {
      const parsed: unknown = JSON.parse(source);
      if (!isRecord(parsed))
        throw new Error('Canonical ProjectReleaseInput must be a JSON object.');
      await writeProjectDeployRelease(props.projectId, parsed as unknown as ProjectReleaseInput);
      props.onMutation();
    } catch (caught) {
      setError(readError(caught));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Card
      title="Prepared release desired state"
      description="Author the exact Deploy ProjectReleaseInput. Saving desired state never executes a provider; execution remains inspect → confirm → execute below."
    >
      {props.release.status === 'ready' ? (
        <KeyValue label="Prepared release revision" value={props.release.data.revision} />
      ) : null}
      <Field label="Canonical ProjectReleaseInput">
        <Input multiline numberOfLines={14} value={source} onChangeText={setSource} />
      </Field>
      {props.release.status === 'loading' ? <Text>Loading prepared release…</Text> : null}
      {props.release.status === 'error' ? (
        <Text color="danger">{props.release.message}</Text>
      ) : null}
      {error ? <Text color="danger">{error}</Text> : null}
      <Button disabled={busy} onPress={() => void save()}>
        {busy ? 'Saving…' : 'Save prepared release'}
      </Button>
    </Card>
  );
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function readError(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
