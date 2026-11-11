import type { FactEnvelope } from '@ankhorage/contracts/rules';
import type { RuleFinding, RuleResultStatus } from '@ankhorage/rules';
import { designRuleCatalog } from '@ankhorage/rules-design';

import type { StudioDesignAssessment } from './evaluateStudioDesignAssessment';

type StudioDesignEvidenceScope = 'page' | 'scroll-sample' | 'viewport';

interface StudioDesignEvidenceGroup {
  readonly facts: readonly FactEnvelope[];
  readonly findings: readonly StudioDesignFindingPresentation[];
  readonly scope: StudioDesignEvidenceScope;
}

interface StudioDesignFindingPresentation {
  readonly advisory: boolean;
  readonly finding: RuleFinding;
  readonly resultStatus: RuleResultStatus | null;
}

export interface StudioDesignAssessmentPresentation {
  readonly colorPolicyVersion: number;
  readonly diagnostics: readonly string[];
  readonly groups: readonly StudioDesignEvidenceGroup[];
  readonly providerId: string;
  readonly providerPackageName: string;
  readonly profileId: string;
  readonly resultStatuses: readonly string[];
  readonly unscopedMissingFacts: readonly Extract<FactEnvelope, { readonly status: 'missing' }>[];
}

/*** Project canonical Rules output into Studio display groups without deriving or changing any rule outcome. */
export function createStudioDesignAssessmentPresentation(
  assessment: StudioDesignAssessment,
): StudioDesignAssessmentPresentation {
  return {
    colorPolicyVersion: assessment.providerOptions.color.version,
    diagnostics: assessment.evaluation.diagnostics.map((diagnostic) => diagnostic.message),
    groups: DESIGN_EVIDENCE_SCOPES.map((scope) => ({
      facts: assessment.facts.filter((fact) => factScope(fact) === scope),
      findings: assessment.evaluation.findings
        .filter((finding) => findingScope(finding) === scope)
        .map((finding) => presentFinding(assessment, finding)),
      scope,
    })),
    providerId: assessment.providerId,
    providerPackageName: assessment.providerPackageName,
    profileId: assessment.profileId,
    resultStatuses: assessment.evaluation.results.map((result) => result.status),
    unscopedMissingFacts: assessment.facts.filter(isUnscopedMissingFact),
  };
}

/*** Preserve missing facts without a renderer value scope instead of dropping their evidence. */
function isUnscopedMissingFact(
  fact: FactEnvelope,
): fact is Extract<FactEnvelope, { readonly status: 'missing' }> {
  return fact.status === 'missing' && factScope(fact) === null;
}

/*** Retain Rules result status, finding severity, and catalog-owned advisory semantics for presentation. */
function presentFinding(
  assessment: StudioDesignAssessment,
  finding: RuleFinding,
): StudioDesignFindingPresentation {
  return {
    advisory: designRuleCatalog.some(
      (entry) => entry.id === finding.ruleId && entry.severity === 'advisory',
    ),
    finding,
    resultStatus:
      assessment.evaluation.results.find((result) => result.rule.id === finding.ruleId)?.status ??
      null,
  };
}

/*** Read the renderer-owned scope marker from an available fact without treating missing data as a pass. */
function factScope(fact: FactEnvelope): StudioDesignEvidenceScope | null {
  if (fact.status !== 'available' || !isRecord(fact.value)) return null;
  return isDesignEvidenceScope(fact.value.scope) ? fact.value.scope : null;
}

/*** Read a provider finding's serialized scope marker only for presentation grouping. */
function findingScope(finding: RuleFinding): StudioDesignEvidenceScope | null {
  if (!isRecord(finding.evidence)) return null;
  return isDesignEvidenceScope(finding.evidence.scope) ? finding.evidence.scope : null;
}

/*** Accept the three frozen Design evidence scopes. */
function isDesignEvidenceScope(value: unknown): value is StudioDesignEvidenceScope {
  return value === 'page' || value === 'viewport' || value === 'scroll-sample';
}

/*** Narrow serialized evidence to a string-keyed record at the presentation boundary. */
function isRecord(value: unknown): value is Readonly<Record<string, unknown>> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

const DESIGN_EVIDENCE_SCOPES = ['page', 'viewport', 'scroll-sample'] as const;
