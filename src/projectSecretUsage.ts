import type { AppManifest } from '@ankhorage/contracts';

export type ProjectSecretUsageCategory = 'oauth-provider' | 'project-config';

export interface ProjectSecretUsage {
  readonly ref: string;
  readonly path: string;
  readonly category: ProjectSecretUsageCategory;
  readonly label: string;
  readonly ownerId?: string;
  readonly breaksWhenMissing: boolean;
}

export interface ProjectSecretUsageSummary {
  readonly ref: string;
  readonly usages: readonly ProjectSecretUsage[];
}

export function findProjectSecretUsages(input: {
  readonly manifest: AppManifest;
  readonly ref: string;
}): ProjectSecretUsageSummary {
  const usages = new Map<string, ProjectSecretUsage>();
  const providers = input.manifest.infra.auth?.oauth?.providers ?? [];

  providers.forEach((provider) => {
    if (provider.credentialsRef !== input.ref) {
      return;
    }

    const ownerId = provider.id;
    const label = `${provider.label ?? titleCase(ownerId)} OAuth provider`;
    const path = `infra.auth.oauth.providers[${ownerId}].credentialsRef`;
    usages.set(
      `${path}:${input.ref}`,
      Object.freeze({
        ref: input.ref,
        path,
        category: 'oauth-provider',
        label,
        ownerId,
        breaksWhenMissing: provider.enabled === true,
      }),
    );
  });

  return {
    ref: input.ref,
    usages: [...usages.values()].sort(compareSecretUsages),
  };
}

function compareSecretUsages(left: ProjectSecretUsage, right: ProjectSecretUsage): number {
  return (
    left.category.localeCompare(right.category) ||
    left.path.localeCompare(right.path) ||
    left.label.localeCompare(right.label) ||
    (left.ownerId ?? '').localeCompare(right.ownerId ?? '')
  );
}

function titleCase(value: string): string {
  return value
    .split(/[-_\s]+/u)
    .filter(Boolean)
    .map((part) => `${part.slice(0, 1).toUpperCase()}${part.slice(1)}`)
    .join(' ');
}
