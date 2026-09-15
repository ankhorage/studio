import type { AppManifest } from '@ankhorage/contracts';
import type { AppEnvironmentId } from '@ankhorage/contracts/environments';
import type { InfraDiagnostic, InfraResourceIdentity, InfraResult } from '@ankhorage/contracts/infra';
import {
  createProjectInfraLifecycle,
  readStoredInfraStateAsync,
  type ProjectInfraLifecycle,
} from '@ankhorage/infra/project';

interface StudioProjectInfraRequest {
  readonly environment?: AppEnvironmentId;
  readonly executionEnvironment?: Readonly<Record<string, string | undefined>>;
  readonly manifest: AppManifest;
  readonly projectId: string;
  readonly projectPath: string;
}

interface StudioProjectInfraDestroyRequest extends StudioProjectInfraRequest {
  readonly deletePersistentResources: boolean;
}

/*** Compose Studio's project infrastructure boundary on top of the provider-neutral Infra lifecycle. */
export function createStudioProjectInfraLifecycle(
  lifecycle: ProjectInfraLifecycle = createProjectInfraLifecycle(),
) {
  return {
    generateAsync: async (request: StudioProjectInfraRequest) =>
      requireInfraSuccess(await lifecycle.generateAsync(toInfraRequest(request))),
    upAsync: async (request: StudioProjectInfraRequest) =>
      requireInfraSuccess(await lifecycle.upAsync(toInfraRequest(request))),
    statusAsync: async (request: StudioProjectInfraRequest) =>
      requireInfraSuccess(await lifecycle.statusAsync(toInfraRequest(request))),
    outputsAsync: async (request: StudioProjectInfraRequest) =>
      requireInfraSuccess(await lifecycle.outputsAsync(toInfraRequest(request))),
    downAsync: async (request: StudioProjectInfraRequest) =>
      requireInfraSuccess(await lifecycle.downAsync(toInfraRequest(request))),
    destroyAsync: async (request: StudioProjectInfraDestroyRequest) => {
      const environment = request.environment ?? 'local';
      const state = await readStoredInfraStateAsync(request.projectPath, environment);
      const confirmedResources = request.deletePersistentResources
        ? persistentResourceIdentities(state?.ledger.resources ?? [])
        : [];
      return requireInfraSuccess(
        await lifecycle.destroyAsync({
          ...toInfraRequest(request),
          confirmation: { projectId: request.projectId, environment },
          persistence: request.deletePersistentResources
            ? { policy: 'delete', confirmedResources }
            : { policy: 'retain' },
        }),
      );
    },
  };
}

/*** Convert a Studio project request into Infra's explicit environment lifecycle request. */
function toInfraRequest(request: StudioProjectInfraRequest) {
  return {
    projectId: request.projectId,
    projectPath: request.projectPath,
    manifest: request.manifest.infra,
    environment: request.environment ?? 'local',
    ...(request.executionEnvironment === undefined
      ? {}
      : { executionEnvironment: request.executionEnvironment }),
  };
}

/*** Extract explicit persistent resource confirmations from one stored Infra ownership ledger. */
function persistentResourceIdentities(
  resources: readonly { readonly identity: InfraResourceIdentity; readonly persistent: boolean }[],
): readonly InfraResourceIdentity[] {
  return resources.filter(({ persistent }) => persistent).map(({ identity }) => identity);
}

/*** Convert provider-neutral Infra diagnostics into one stable Studio operation failure. */
function requireInfraSuccess<T>(result: InfraResult<T>): T {
  if (result.ok) return result.value;
  const message = formatInfraDiagnostics(result.diagnostics);
  throw new Error(message.length > 0 ? message : 'Infrastructure operation failed.');
}

/*** Format safe Infra diagnostics without exposing privileged values. */
function formatInfraDiagnostics(diagnostics: readonly InfraDiagnostic[]): string {
  return diagnostics.map(({ code, message }) => `${code}: ${message}`).join('\n');
}
