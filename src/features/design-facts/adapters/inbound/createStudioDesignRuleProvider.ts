import type {
  DesignRuleProfileSelection,
  DesignRuleProviderOptions,
} from '@ankhorage/rules-design';
import { createDesignRuleProvider, selectDesignRuleProfile } from '@ankhorage/rules-design';

/*** Create Studio's public Design provider contribution for an explicitly selected published profile. */
export function createStudioDesignRuleProvider(
  options: DesignRuleProviderOptions,
  profileId: string,
): {
  readonly profile: DesignRuleProfileSelection;
  readonly provider: ReturnType<typeof createDesignRuleProvider>;
} {
  return {
    profile: selectDesignRuleProfile(profileId),
    provider: createDesignRuleProvider(options),
  };
}
