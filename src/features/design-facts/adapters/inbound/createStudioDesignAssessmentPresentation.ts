import type { FactEnvelope } from '@ankhorage/contracts/rules';
import type { RuleFinding } from '@ankhorage/rules';

import type { StudioDesignAssessment } from './evaluateStudioDesignAssessment';

type StudioDesignEvidenceScope = 'page' | 'scroll-sample' | 'viewport';

interface StudioDesignEvidenceGroup {
  readonly facts: readonly FactEnvelope[];
  readonly findings: readonly RuleFinding[];
  readonly scope: StudioDesignEvidenceScope;
}

export interface StudioDesignAssessmentPresentation {
  readonly diagnostics: readonly string[];
  readonly groups: readonly StudioDesignEvidenceGroup[];
  readonly profileId: string;
  readonly resultStatuses: readonly string[];
}

/*** Project canonical Rules output into Studio display groups without deriving or changing any rule outcome. */
export function createStudioDesignAssessmentPresentation(
  assessment: StudioDesignAssessment,
): StudioDesignAssessmentPresentation {
  return {
    diagnostics: assessment.evaluation.diagnostics.map((diagnostic) => diagnostic.message),
    groups: DESIGN_EVIDENCE_SCOPES.map((scope) => ({
      facts: assessment.facts.filter((fact) => factScope(fact) === scope),
      findings: assessment.evaluation.findings.filter((finding) => findingScope(finding) === scope),
      scope,
    })),
    profileId: assessment.profileId,
    resultStatuses: assessment.evaluation.results.map((result) => result.status),
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
