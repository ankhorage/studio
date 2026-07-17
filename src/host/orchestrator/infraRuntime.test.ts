import { mkdir, mkdtemp, readFile, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';

import { expect, test } from 'bun:test';

import {
  ensureProjectInfraPortForward,
  InfraScriptExecutionError,
  registerProjectInfraPortForwardOwner,
  runProjectInfraScript,
  runProjectInfraScriptCapture,
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

test('uses generated .env app forward port before .env.example', async () => {
  const rootPath = await mkdtemp(path.join(tmpdir(), 'ankh-studio-port-forward-env-'));
  const projectId = 'demo';
  const infraRoot = path.join(rootPath, 'apps', projectId, 'infra', 'minikube');
  const scriptsRoot = path.join(infraRoot, 'scripts');
  await mkdir(scriptsRoot, { recursive: true });
  await writeFile(path.join(infraRoot, '.env.example'), 'APP_PORT_FORWARD_LOCAL_PORT=19092\n');
  await writeFile(path.join(infraRoot, '.env'), 'APP_PORT_FORWARD_LOCAL_PORT=19093\n');
  await writePortForwardScript(path.join(scriptsRoot, 'port-forward.sh'), 'app: running');

  const result = await ensureProjectInfraPortForward({
    rootPath,
    projectId,
    target: 'minikube',
  });

  expect(result).toEqual({ url: 'http://127.0.0.1:19093', started: false });
  await stopAllProjectInfraPortForwards();
});

test('falls back to generated .env.example app forward port', async () => {
  const rootPath = await mkdtemp(path.join(tmpdir(), 'ankh-studio-port-forward-example-'));
  const projectId = 'demo';
  const infraRoot = path.join(rootPath, 'apps', projectId, 'infra', 'minikube');
  const scriptsRoot = path.join(infraRoot, 'scripts');
  await mkdir(scriptsRoot, { recursive: true });
  await writeFile(path.join(infraRoot, '.env.example'), 'APP_PORT_FORWARD_LOCAL_PORT=19094\n');
  await writePortForwardScript(path.join(scriptsRoot, 'port-forward.sh'), 'app: running');

  const result = await ensureProjectInfraPortForward({
    rootPath,
    projectId,
    target: 'minikube',
  });

  expect(result).toEqual({ url: 'http://127.0.0.1:19094', started: false });
  await stopAllProjectInfraPortForwards();
});

test('fails when generated app forward port is missing', async () => {
  const rootPath = await mkdtemp(path.join(tmpdir(), 'ankh-studio-port-forward-missing-'));
  const projectId = 'demo';
  const scriptsRoot = path.join(rootPath, 'apps', projectId, 'infra', 'minikube', 'scripts');
  await mkdir(scriptsRoot, { recursive: true });
  await writePortForwardScript(path.join(scriptsRoot, 'port-forward.sh'), 'app: stopped');

  await expectRejects(
    () =>
      ensureProjectInfraPortForward({
        rootPath,
        projectId,
        target: 'minikube',
      }),
    /APP_PORT_FORWARD_LOCAL_PORT/u,
  );
});

test('fails when generated app forward port is invalid', async () => {
  const rootPath = await mkdtemp(path.join(tmpdir(), 'ankh-studio-port-forward-invalid-'));
  const projectId = 'demo';
  const infraRoot = path.join(rootPath, 'apps', projectId, 'infra', 'minikube');
  const scriptsRoot = path.join(infraRoot, 'scripts');
  await mkdir(scriptsRoot, { recursive: true });
  await writeFile(path.join(infraRoot, '.env.example'), 'APP_PORT_FORWARD_LOCAL_PORT=not-a-port\n');
  await writePortForwardScript(path.join(scriptsRoot, 'port-forward.sh'), 'app: stopped');

  await expectRejects(
    () =>
      ensureProjectInfraPortForward({
        rootPath,
        projectId,
        target: 'minikube',
      }),
    /valid APP_PORT_FORWARD_LOCAL_PORT/u,
  );
});

test('resolves distinct generated ports for two projects', async () => {
  const rootPath = await mkdtemp(path.join(tmpdir(), 'ankh-studio-port-forward-distinct-'));
  await createGeneratedForwardProject(rootPath, 'demo-a', 19095);
  await createGeneratedForwardProject(rootPath, 'demo-b', 19096);

  const first = await registerProjectInfraPortForwardOwner({
    rootPath,
    projectId: 'demo-a',
    target: 'minikube',
  });
  const second = await registerProjectInfraPortForwardOwner({
    rootPath,
    projectId: 'demo-b',
    target: 'minikube',
  });

  expect(first.url).toBe('http://127.0.0.1:19095');
  expect(second.url).toBe('http://127.0.0.1:19096');
  await stopAllProjectInfraPortForwards();
});

test('infra script capture failures preserve stdout stderr and exit code', async () => {
  const rootPath = await mkdtemp(path.join(tmpdir(), 'ankh-studio-infra-script-error-'));
  const projectId = 'demo';
  const scriptsRoot = path.join(rootPath, 'apps', projectId, 'infra', 'minikube', 'scripts');
  await mkdir(scriptsRoot, { recursive: true });
  await writeFile(
    path.join(scriptsRoot, 'status.sh'),
    `#!/usr/bin/env bash
echo "status stdout"
echo "status stderr" >&2
exit 7
`,
  );

  try {
    await runProjectInfraScriptCapture({
      rootPath,
      projectId,
      target: 'minikube',
      script: 'status',
    });
    throw new Error('Expected status script to fail.');
  } catch (error) {
    expect(error).toBeInstanceOf(InfraScriptExecutionError);
    const infraError = error as InfraScriptExecutionError;
    expect(infraError.exitCode).toBe(7);
    expect(infraError.stdout).toContain('status stdout');
    expect(infraError.stderr).toContain('status stderr');
  }
});

test('runProjectInfraScript delegates to generated scripts', async () => {
  const rootPath = await mkdtemp(path.join(tmpdir(), 'ankh-studio-infra-script-run-'));
  const projectId = 'demo';
  const scriptsRoot = path.join(rootPath, 'apps', projectId, 'infra', 'minikube', 'scripts');
  const markerPath = path.join(rootPath, 'ran-up');
  await mkdir(scriptsRoot, { recursive: true });
  await writeFile(
    path.join(scriptsRoot, 'up.sh'),
    `#!/usr/bin/env bash
touch ${JSON.stringify(markerPath)}
`,
  );

  await runProjectInfraScript({
    rootPath,
    projectId,
    target: 'minikube',
    script: 'up',
  });

  expect(await readFile(markerPath, 'utf8')).toBe('');
});

async function createGeneratedForwardProject(
  rootPath: string,
  projectId: string,
  port: number,
): Promise<void> {
  const infraRoot = path.join(rootPath, 'apps', projectId, 'infra', 'minikube');
  const scriptsRoot = path.join(infraRoot, 'scripts');
  await mkdir(scriptsRoot, { recursive: true });
  await writeFile(path.join(infraRoot, '.env.example'), `APP_PORT_FORWARD_LOCAL_PORT=${port}\n`);
  await writePortForwardScript(path.join(scriptsRoot, 'port-forward.sh'), 'app: running');
}

async function writePortForwardScript(scriptPath: string, statusOutput: string): Promise<void> {
  await writeFile(
    scriptPath,
    `#!/usr/bin/env bash
set -euo pipefail
case "\${1:-}:\${2:-}" in
  status:app) echo ${JSON.stringify(statusOutput)} ;;
  start:app) echo "app: started" ;;
  stop:all) echo "all: stopped" ;;
  *) echo "unexpected args: $*" >&2; exit 1 ;;
esac
`,
  );
}

async function expectRejects(
  operation: () => Promise<unknown>,
  expectedMessage: RegExp,
): Promise<void> {
  try {
    await operation();
    throw new Error('Expected operation to reject.');
  } catch (error) {
    expect(error).toBeInstanceOf(Error);
    expect((error as Error).message).toMatch(expectedMessage);
  }
}
