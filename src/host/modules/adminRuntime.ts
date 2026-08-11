import type { UiNode } from '@ankhorage/contracts';

export interface HostModuleAdminInvocation {
  readonly operation: string;
  readonly input?: unknown;
}

export interface HostModuleAdminExecutionRequest extends HostModuleAdminInvocation {
  readonly componentMeta?: unknown;
}

export interface HostModuleAdminManifestScreen {
  readonly id: string;
  readonly root: UiNode;
}

export interface HostModuleAdminAuthoringContext {
  readonly screens: readonly HostModuleAdminManifestScreen[];
  readonly componentMeta: unknown;
}

export interface HostModuleManifestFieldMutation {
  readonly screenId: string;
  readonly nodeId: string;
  readonly prop: string;
  readonly value: unknown;
}

export interface HostModuleAdminRuntimeContext {
  readonly projectRoot: string;
  readonly readConfig: () => Promise<unknown>;
  readonly reconfigureConfig: (config: unknown) => Promise<void>;
  readonly readAuthoringContext: () => Promise<HostModuleAdminAuthoringContext>;
  readonly mutateManifestField: (mutation: HostModuleManifestFieldMutation) => Promise<void>;
}

export interface HostModuleAdminRuntime {
  readonly kind: 'module-admin-runtime';
  readonly execute: (
    context: HostModuleAdminRuntimeContext,
    invocation: HostModuleAdminInvocation,
  ) => Promise<unknown>;
}

export function resolveHostModuleAdminRuntime(value: unknown): HostModuleAdminRuntime | null {
  return isHostModuleAdminRuntime(value) ? value : null;
}

export async function executeHostModuleAdminRuntime(args: {
  readonly runtime: HostModuleAdminRuntime;
  readonly context: HostModuleAdminRuntimeContext;
  readonly request: HostModuleAdminExecutionRequest;
}): Promise<unknown> {
  const operation = args.request.operation.trim();
  if (!operation) throw new Error('Module admin operation must not be empty.');

  return await args.runtime.execute(args.context, {
    operation,
    ...(args.request.input === undefined ? {} : { input: args.request.input }),
  });
}

function isHostModuleAdminRuntime(value: unknown): value is HostModuleAdminRuntime {
  return (
    isRecord(value) &&
    value.kind === 'module-admin-runtime' &&
    typeof value.execute === 'function'
  );
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
