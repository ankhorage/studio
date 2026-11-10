import type { FactEnvelope } from '@ankhorage/contracts/rules';
import { evaluateRules, type RuleEvaluationResult } from '@ankhorage/rules';
import type { DesignRuleProviderOptions } from '@ankhorage/rules-design';

import { createStudioDesignFacts, type StudioDesignFactsInput } from './createStudioDesignFacts';
import { createStudioDesignRuleProvider } from './createStudioDesignRuleProvider';

const RENDERED_AREA_ANALYSIS_CAPABILITY = 'rendered.area-analysis';

export interface StudioDesignAssessmentInput {
  readonly facts: StudioDesignFactsInput;
  readonly providerOptions: DesignRuleProviderOptions;
}

export interface StudioDesignAssessment {
  readonly evaluation: RuleEvaluationResult;
  readonly facts: readonly FactEnvelope[];
  readonly profileId: 'design.60-30-10';
}

/*** Acquire Studio render facts and evaluate the provider-selected advisory Design profile through Rules. */
export function evaluateStudioDesignAssessment(
  input: StudioDesignAssessmentInput,
): StudioDesignAssessment {
  const facts = createStudioDesignFacts(input.facts);
  const contribution = createStudioDesignRuleProvider(input.providerOptions);
  const scope = facts[0]?.scope;

  if (!scope) {
    throw new Error('Studio Design fact acquisition must retain one scoped missing fact.');
  }

  return {
    evaluation: evaluateRules({ facts }, contribution.provider.ruleSet.rules, {
      capabilities: [RENDERED_AREA_ANALYSIS_CAPABILITY],
      scope: { id: scope.id, kind: scope.kind },
      selection: contribution.profile.selection,
    }),
    facts,
    profileId: 'design.60-30-10',
  };
}
