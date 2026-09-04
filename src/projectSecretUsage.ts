import type { AppManifest } from '@ankhorage/contracts';
import { chainComparators } from '@ankhorage/utility/sort';
import { titleCaseIdentifier } from '@ankhorage/utility/string';

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

/***
 * Find and summarize manifest usages of one project secret reference.
 * @todo Move project secret usage analysis under src/secrets/.
 */
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
    const label = `${provider.label ?? titleCaseIdentifier(ownerId)} OAuth provider`;
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

/***
 * Compare secret usages by category, path, label, and owner id in stable priority order.
 * @utility @ankhorage/utility/sort
 */
function compareSecretUsages(left: ProjectSecretUsage, right: ProjectSecretUsage): number {
  return chainComparators<ProjectSecretUsage>([
    (a, b) => a.category.localeCompare(b.category),
    (a, b) => a.path.localeCompare(b.path),
    (a, b) => a.label.localeCompare(b.label),
    (a, b) => (a.ownerId ?? '').localeCompare(b.ownerId ?? ''),
  ])(left, right);
}
