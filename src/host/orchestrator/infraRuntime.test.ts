import { mkdir, mkdtemp, readFile, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';

import { expect, test } from 'bun:test';

import {
  ensureProjectInfraPortForward,
  registerProjectInfraPortForwardOwner,
  stopAllProjectInfraPortForwards,
} from './infraRuntime';

test('uses generated port-forward lifecycle script instead of tracking kubectl children', async () => {
  const rootPath = await mkdtemp(path.join(tmpdir(), 'ankh-studio-port-forward-'));
  const projectId = 'demo';
  const infraRoot = path.join(rootPath, 'apps', projectId, 'infra', 'minikube');
  const scriptsRoot = path.join(infraRoot, 'scripts');
  const logPath = path.join(rootPath, 'port-forward-args.log');
  const statePath = path.join(rootPath, 'port-forward-running');

  await mkdir(scriptsRoot, { recursive: true });
  await writeFile(path.join(infraRoot, '.env.example'), 'APP_PORT_FORWARD_LOCAL_PORT=19090\n');
  await writeFile(
    path.join(scriptsRoot, 'port-forward.sh'),
    `#!/usr/bin/env bash
set -euo pipefail
LOG_FILE=${JSON.stringify(logPath)}
STATE_FILE=${JSON.stringify(statePath)}
printf '%s %s\\n' "\${1:-}" "\${2:-}" >> "\${LOG_FILE}"
case "\${1:-}:\${2:-}" in
  status:app)
    if [[ -f "\${STATE_FILE}" ]]; then
      echo "app: running pid=123 url=127.0.0.1:19090 target=app/service/app-runtime:80"
    else
      echo "app: stopped"
    fi
    ;;
  start:app)
    touch "\${STATE_FILE}"
    echo "app: started (pid 123, local port 19090)"
    ;;
  stop:all)
    rm -f "\${STATE_FILE}"
    echo "all: stopped"
    ;;
  *)
    echo "unexpected args: $*" >&2
    exit 1
    ;;
esac
`,
  );

  const first = await ensureProjectInfraPortForward({
    rootPath,
    projectId,
    target: 'minikube',
  });
  expect(first).toEqual({ url: 'http://127.0.0.1:19090', started: true });

  const second = await ensureProjectInfraPortForward({
    rootPath,
    projectId,
    target: 'minikube',
  });
  expect(second).toEqual({ url: 'http://127.0.0.1:19090', started: false });

  await stopAllProjectInfraPortForwards();

  expect((await readFile(logPath, 'utf8')).trim().split('\n')).toEqual([
    'status app',
    'start app',
    'status app',
    'stop all',
  ]);
});

test('shutdown stops generated forwards registered by infra up even without launch', async () => {
  const rootPath = await mkdtemp(path.join(tmpdir(), 'ankh-studio-port-forward-owner-'));
  const projectId = 'demo';
  const infraRoot = path.join(rootPath, 'apps', projectId, 'infra', 'minikube');
  const scriptsRoot = path.join(infraRoot, 'scripts');
  const logPath = path.join(rootPath, 'port-forward-args.log');

  await mkdir(scriptsRoot, { recursive: true });
  await writeFile(path.join(infraRoot, '.env.example'), 'APP_PORT_FORWARD_LOCAL_PORT=19091\n');
  await writeFile(
    path.join(scriptsRoot, 'port-forward.sh'),
    `#!/usr/bin/env bash
set -euo pipefail
LOG_FILE=${JSON.stringify(logPath)}
printf '%s %s\\n' "\${1:-}" "\${2:-}" >> "\${LOG_FILE}"
`,
  );

  await registerProjectInfraPortForwardOwner({
    rootPath,
    projectId,
    target: 'minikube',
  });
  await stopAllProjectInfraPortForwards();

  expect((await readFile(logPath, 'utf8')).trim()).toBe('stop all');
});
