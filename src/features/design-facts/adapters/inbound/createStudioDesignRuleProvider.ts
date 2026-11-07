import type { DesignRuleProviderOptions } from '@ankhorage/rules-design';
import { createDesignRuleProvider, selectDesignRuleProfile } from '@ankhorage/rules-design';

/*** Create Studio's public Design provider contribution and select its canonical 60-30-10 profile. */
export function createStudioDesignRuleProvider(options: DesignRuleProviderOptions) {
  return {
    profile: selectDesignRuleProfile('design.60-30-10'),
    provider: createDesignRuleProvider(options),
  };
}
