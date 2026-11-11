import { describe, expect, it } from 'bun:test';

import { createStudioDesignFacts } from './createStudioDesignFacts';
import { createStudioDesignRuleProvider } from './createStudioDesignRuleProvider';

const input = {
  breakpointId: 'desktop',
  collectedAt: '2026-11-07T00:00:00.000Z',
  projectId: 'catalog',
  screenId: 'home',
  sourceRevision: 'manifest-sha',
  tenantId: 'tenant-a',
};

describe('createStudioDesignFacts', () => {
  it('keeps page and viewport measurements separate with renderer evidence', () => {
    const facts = createStudioDesignFacts({
      ...input,
      measurements: [
        {
          evidence: {
            colorFamilies: { accent: ['brand-500'] },
            viewport: { height: 900, width: 1440 },
          },
          measuredPixels: 100,
          rolePixels: { accent: 10, base: 60, secondary: 30, unknown: 0 },
          scope: 'page',
          scopeId: 'page',
          themeId: 'light',
          unknownPixels: 0,
        },
        {
          measuredPixels: 100,
          rolePixels: { accent: 50, base: 30, secondary: 20, unknown: 0 },
          scope: 'viewport',
          scopeId: 'hero',
          themeId: 'light',
          unknownPixels: 0,
        },
        {
          measuredPixels: 100,
          rolePixels: { accent: 10, base: 60, secondary: 30, unknown: 0 },
          scope: 'scroll-sample',
          scopeId: 'details',
          themeId: 'light',
          unknownPixels: 0,
        },
      ],
    });

    expect(facts).toHaveLength(3);
    expect(facts[0]).toMatchObject({
      scope: { id: 'studio:tenant-a:project:catalog:screen:home' },
      status: 'available',
      value: {
        rolePixels: { accent: 10, base: 60, secondary: 30, unknown: 0 },
        scope: 'page',
      },
    });
    expect(facts[1]).toMatchObject({ status: 'available', value: { scope: 'viewport' } });
    expect(facts[2]).toMatchObject({ status: 'available', value: { scope: 'scroll-sample' } });
  });

  it('makes missing and incomplete renderer evidence explicit', () => {
    const missing = createStudioDesignFacts({ ...input, measurements: [] });
    const invalid = createStudioDesignFacts({
      ...input,
      measurements: [
        {
          measuredPixels: 100,
          rolePixels: { accent: 10, base: 60, secondary: 30, unknown: 0 },
          scope: 'page',
          scopeId: 'page',
          themeId: 'light',
          unknownPixels: 1,
        },
      ],
    });

    expect(missing[0]).toMatchObject({
      missing: { code: 'rendered-area-unavailable' },
      status: 'missing',
    });
    expect(invalid[0]).toMatchObject({
      missing: { code: 'rendered-area-invalid' },
      status: 'missing',
    });
  });
});

describe('createStudioDesignRuleProvider', () => {
  it('uses the released profile and provider', () => {
    const contribution = createStudioDesignRuleProvider(
      {
        color: colorPolicy,
        typography: typographyPolicy,
      },
      'design.60-30-10',
    );
    expect(contribution.profile.profileId).toBe('design.60-30-10');
    expect(contribution.profile.selection.rootRuleIds).toEqual(['design.color.usage-distribution']);
    expect(contribution.provider.packageName).toBe('@ankhorage/rules-design');
  });

  it('passes complete page, viewport, and scroll renderer evidence to the provider-owned rule', () => {
    const facts = createStudioDesignFacts({
      ...input,
      measurements: [
        {
          measuredPixels: 100,
          rolePixels: { accent: 10, base: 60, secondary: 30, unknown: 0 },
          scope: 'page',
          scopeId: 'page',
          themeId: 'light',
          unknownPixels: 0,
        },
        {
          measuredPixels: 100,
          rolePixels: { accent: 10, base: 60, secondary: 30, unknown: 0 },
          scope: 'viewport',
          scopeId: 'hero',
          themeId: 'light',
          unknownPixels: 0,
        },
        {
          measuredPixels: 100,
          rolePixels: { accent: 10, base: 60, secondary: 30, unknown: 0 },
          scope: 'scroll-sample',
          scopeId: 'details',
          themeId: 'light',
          unknownPixels: 0,
        },
      ],
    });
    const contribution = createStudioDesignRuleProvider(
      {
        color: colorPolicy,
        typography: typographyPolicy,
      },
      'design.60-30-10',
    );
    const rule = contribution.provider.ruleSet.rules.find(
      ({ identity }) => identity.id === 'design.color.usage-distribution',
    );
    const scope = facts[0]?.scope;

    if (!rule) throw new Error('The Design provider did not register its 60-30-10 rule.');
    if (!scope) throw new Error('The renderer did not produce its page fact.');

    expect(
      rule.evaluate({
        context: { facts },
        dependencyResults: [],
        options: undefined,
        scope,
      }),
    ).toMatchObject({ findings: [], status: 'PASS' });
  });
});

const colorPolicy = {
  allowedColorSyntaxes: ['hex'],
  allowedTokens: ['base'],
  alphaCompositions: { base: { base: 'base' } },
  canonicalLiterals: { '#ffffff': 'base' },
  knownTokens: ['base'],
  rampTokens: { base: ['base'] },
  requiredBreakpointIds: ['desktop'],
  requiredScopes: ['page', 'viewport', 'scroll-sample'] as const,
  requiredThemeIds: ['light'],
  roleTargets: { accent: 0.1, base: 0.6, secondary: 0.3 },
  roleTolerances: { accent: 0.1, base: 0.1, secondary: 0.1 },
  semanticRoleTokens: { base: ['base'] },
  stateTokens: {
    active: { base: 'base' },
    disabled: { base: 'base' },
    hover: { base: 'base' },
  },
  surfaceRoleTokens: { page: ['base'] },
  themeTokens: { base: ['light'] },
  version: 1,
};

const typographyPolicy = {
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
};
