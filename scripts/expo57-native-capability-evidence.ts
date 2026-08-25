import path from 'node:path';

import { NATIVE_EVIDENCE_SERVER_PORT } from '../src/host/smoke/nativeCapabilityEvidence/constants';
import { createNativeEvidenceServer } from '../src/host/smoke/nativeCapabilityEvidence/createNativeEvidenceServer';
import { prepareNativeCapabilityEvidenceAsync } from '../src/host/smoke/nativeCapabilityEvidence/prepareNativeCapabilityEvidenceAsync';

const [command, ...args] = process.argv.slice(2);
const [rawWorkspaceRoot] = args;
const workspaceRoot = rawWorkspaceRoot
  ? path.resolve(rawWorkspaceRoot)
  : '/tmp/ankh-expo57-native-evidence';

if (command === 'prepare') {
  await prepareNativeCapabilityEvidenceAsync(workspaceRoot);
} else if (command === 'serve') {
  const server = createNativeEvidenceServer({ workspaceRoot });
  console.log(
    `Native evidence fixture listening at http://127.0.0.1:${NATIVE_EVIDENCE_SERVER_PORT}.`,
  );
  console.log(`Safe evidence is appended under ${workspaceRoot}/evidence/.`);
  await waitForShutdownAsync(server);
} else if (command === 'queue') {
  const [scenario, permission] = args;
  if (!scenario) throw new Error('A native evidence scenario is required.');
  await requestFixtureAsync('/command', {
    ...(permission ? { permission } : {}),
    scenario,
  });
  console.log(`Queued native evidence scenario: ${scenario}.`);
} else if (command === 'state') {
  const response = await fetch(`http://127.0.0.1:${NATIVE_EVIDENCE_SERVER_PORT}/state`);
  if (!response.ok) throw new Error(`Native evidence fixture returned HTTP ${response.status}.`);
  console.log(JSON.stringify(await response.json(), null, 2));
} else {
  throw new Error(
    'Usage: bun run smoke:expo57-native -- <prepare|serve> [absolute-workspace-path]\n' +
      '       bun run smoke:expo57-native -- queue <scenario> [permission]\n' +
      '       bun run smoke:expo57-native -- state',
  );
}

async function requestFixtureAsync(
  requestPath: string,
  body: Readonly<Record<string, string>>,
): Promise<void> {
  const response = await fetch(`http://127.0.0.1:${NATIVE_EVIDENCE_SERVER_PORT}${requestPath}`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (!response.ok) throw new Error(`Native evidence fixture returned HTTP ${response.status}.`);
}

function waitForShutdownAsync(server: ReturnType<typeof Bun.serve>): Promise<void> {
  return new Promise((resolve) => {
    const stop = () => {
      void server.stop(true);
      resolve();
    };
    process.once('SIGINT', stop);
    process.once('SIGTERM', stop);
  });
}
