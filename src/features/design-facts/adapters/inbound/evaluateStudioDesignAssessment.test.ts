import type { DesignRuleProviderOptions } from '@ankhorage/rules-design';
import { describe, expect, it } from 'bun:test';

import { createStudioDesignAssessmentPresentation } from './createStudioDesignAssessmentPresentation';
import { evaluateStudioDesignAssessment } from './evaluateStudioDesignAssessment';

const providerOptions = {
  color: {
    allowedColorSyntaxes: ['hex'],
    allowedTokens: ['base'],
    alphaCompositions: { base: { base: 'base' } },
    canonicalLiterals: { '#ffffff': 'base' },
    knownTokens: ['base'],
    rampTokens: { base: ['base'] },
    requiredBreakpointIds: ['desktop'],
    requiredScopes: ['page', 'viewport', 'scroll-sample'],
    requiredThemeIds: ['light'],
    roleTargets: { accent: 0.1, base: 0.6, secondary: 0.3 },
    roleTolerances: { accent: 0.01, base: 0.01, secondary: 0.01 },
    semanticRoleTokens: { base: ['base'] },
    stateTokens: {
      active: { base: 'base' },
      disabled: { base: 'base' },
      hover: { base: 'base' },
    },
    surfaceRoleTokens: { page: ['base'] },
    themeTokens: { base: ['light'] },
    version: 1,
  },
  typography: {
    allowedFontFamilies: ['sans-serif'],
    allowedFontSizes: [16],
    allowedFontWeights: ['400'],
    allowedLetterSpacings: [0],
    allowedLineHeights: [24],
    allowedSemanticStyles: { body: ['body'] },
    allowedSpacingAfter: [0],
    allowedSpacingBefore: [0],
    maximumH1Count: 1,
    maximumParagraphMeasure: 80,
    minimumBodyFontSize: 16,
    minimumH1Count: 1,
    minimumParagraphMeasure: 40,
    responsiveFontSizes: { body: [16] },
  },
} satisfies DesignRuleProviderOptions;

const assessmentInput = {
  facts: {
    breakpointId: 'desktop',
    collectedAt: '2026-11-10T00:00:00.000Z',
    projectId: 'catalog',
    screenId: 'home',
    sourceRevision: 'manifest-sha',
    tenantId: 'tenant-a',
  },
  profileId: 'design.60-30-10',
  providerOptions,
};

describe('evaluateStudioDesignAssessment', () => {
  it('retains canonical PASS output and all three renderer evidence scopes', () => {
    const assessment = evaluateStudioDesignAssessment({
      ...assessmentInput,
      facts: {
        ...assessmentInput.facts,
        measurements: measurements(),
      },
    });

    expect(assessment.evaluation.results.map((result) => result.status)).toEqual(['PASS']);
    expect(assessment.profileId).toBe('design.60-30-10');
    expect(
      createStudioDesignAssessmentPresentation(assessment).groups.map((group) => group.scope),
    ).toEqual(['page', 'viewport', 'scroll-sample']);
  });

  it('retains canonical FAIL findings instead of translating them in Studio', () => {
    const assessment = evaluateStudioDesignAssessment({
      ...assessmentInput,
      facts: {
        ...assessmentInput.facts,
        measurements: measurements({ page: { accent: 50, base: 10, secondary: 40 } }),
      },
    });

    expect(assessment.evaluation.results.map((result) => result.status)).toEqual(['FAIL']);
    expect(assessment.evaluation.findings[0]?.message).toContain(
      'outside its configured tolerance',
    );
  });

  it('keeps missing renderer evidence INCOMPLETE without inventing a pass', () => {
    const assessment = evaluateStudioDesignAssessment({
      ...assessmentInput,
      facts: {
        ...assessmentInput.facts,
        measurements: [],
      },
    });

    expect(assessment.evaluation.results.map((result) => result.status)).toEqual(['INCOMPLETE']);
    expect(assessment.facts[0]).toMatchObject({ status: 'missing' });
  });

  it('keeps an advisory viewport deviation out of the page evidence group', () => {
    const assessment = evaluateStudioDesignAssessment({
      ...assessmentInput,
      facts: {
        ...assessmentInput.facts,
        measurements: measurements({ viewport: { accent: 50, base: 10, secondary: 40 } }),
      },
    });
    const presentation = createStudioDesignAssessmentPresentation(assessment);
    const page = presentation.groups.find((group) => group.scope === 'page');
    const viewport = presentation.groups.find((group) => group.scope === 'viewport');

    expect(assessment.evaluation.results.map((result) => result.status)).toEqual(['PASS']);
    expect(page?.findings).toEqual([]);
    expect(viewport?.facts[0]).toMatchObject({
      status: 'available',
      value: { scope: 'viewport' },
    });
  });
});

/*** Create one complete renderer measurement per frozen 60-30-10 evidence scope. */
function measurements(overrides: Partial<Record<StudioDesignEvidenceScope, RolePixels>> = {}) {
  return (['page', 'viewport', 'scroll-sample'] as const).map((scope) => {
    const pixels = pixelsForScope(overrides, scope);

    return {
      measuredPixels: 100,
      rolePixels: { ...pixels, unknown: 0 },
      scope,
      scopeId: scope,
      themeId: 'light',
      unknownPixels: 0,
    };
  });
}

/*** Select explicit fixture pixels without dynamic property access. */
function pixelsForScope(
  overrides: Partial<Record<StudioDesignEvidenceScope, RolePixels>>,
  scope: StudioDesignEvidenceScope,
): RolePixels {
  if (scope === 'page') return overrides.page ?? DEFAULT_ROLE_PIXELS;
  if (scope === 'viewport') return overrides.viewport ?? DEFAULT_ROLE_PIXELS;
  return overrides['scroll-sample'] ?? DEFAULT_ROLE_PIXELS;
}

interface RolePixels {
  accent: number;
  base: number;
  secondary: number;
}
type StudioDesignEvidenceScope = 'page' | 'scroll-sample' | 'viewport';

const DEFAULT_ROLE_PIXELS: RolePixels = { accent: 10, base: 60, secondary: 30 };
