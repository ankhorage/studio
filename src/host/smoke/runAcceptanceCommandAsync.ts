export async function runAcceptanceCommandAsync(options: {
  readonly args: readonly string[];
  readonly captureOutput?: boolean;
  readonly command: string;
  readonly cwd: string;
  readonly env?: Readonly<Record<string, string>>;
  readonly label: string;
  readonly timeoutMs?: number;
}): Promise<string> {
  console.log(`\n==> ${options.label}`);
  const childProcess = Bun.spawn([options.command, ...options.args], {
    cwd: options.cwd,
    env: {
      ...Bun.env,
      CI: '1',
      TMPDIR: '/tmp',
      ...options.env,
    },
    stderr: 'inherit',
    stdout: options.captureOutput ? 'pipe' : 'inherit',
  });
  const timeout =
    options.timeoutMs === undefined
      ? undefined
      : setTimeout(() => childProcess.kill(), options.timeoutMs);
  const output = options.captureOutput ? await new Response(childProcess.stdout).text() : '';
  const exitCode = await childProcess.exited;
  if (timeout !== undefined) clearTimeout(timeout);
  if (exitCode !== 0) throw new Error(`${options.label} failed with exit code ${exitCode}.`);
  return output;
}
