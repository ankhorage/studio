import { createHash } from 'node:crypto';

import type { FactEnvelope, RulesProvenance, Scope } from '@ankhorage/contracts/rules';

const FACT_KIND = 'design.color.usage-distribution';

type StudioDesignEvidence =
  | boolean
  | null
  | number
  | string
  | readonly StudioDesignEvidence[]
  | { readonly [key: string]: StudioDesignEvidence };

export interface StudioRenderedAreaMeasurement {
  /** Renderer evidence for color families, alpha compositing, glyphs, borders, and media. */
  readonly evidence?: Readonly<Record<string, StudioDesignEvidence>>;
  readonly measuredPixels: number;
  readonly rolePixels: {
    readonly accent: number;
    readonly base: number;
    readonly secondary: number;
    readonly unknown: number;
  };
  readonly scope: 'page' | 'scroll-sample' | 'viewport';
  readonly scopeId: string;
  readonly themeId: string;
  readonly unknownPixels: number;
  readonly [metadata: string]: unknown;
}

export interface StudioDesignFactsInput {
  readonly breakpointId: string;
  readonly collectedAt: string;
  readonly measurements: readonly StudioRenderedAreaMeasurement[];
  readonly projectId: string;
  readonly screenId: string;
  readonly sourceRevision: string | null;
  readonly tenantId: string;
}

/*** Build portable Design facts only from independently measured Studio render evidence. */
export function createStudioDesignFacts(input: StudioDesignFactsInput): readonly FactEnvelope[] {
  const scope = createScope(input);
  const provenance = createProvenance(input);

  return input.measurements.length === 0
    ? [missingFact(scope, provenance, input.breakpointId, 'rendered-area-unavailable')]
    : input.measurements.map((measurement) =>
        isCompleteMeasurement(input.breakpointId, measurement)
          ? availableFact(scope, provenance, input.breakpointId, measurement)
          : missingFact(scope, provenance, input.breakpointId, 'rendered-area-invalid'),
      );
}

/*** Create the exact serializable Rules scope for one Studio screen. */
function createScope(input: StudioDesignFactsInput): Scope {
  const projectId = `studio:${input.tenantId}:project:${input.projectId}`;

  return {
    id: `${projectId}:screen:${input.screenId}`,
    kind: 'page',
    target: {
      kind: 'studio-screen',
      projectId,
      targetId: input.screenId,
      tenantId: input.tenantId,
    },
  };
}

/*** Retain Studio source provenance without turning authoring declarations into paint evidence. */
function createProvenance(input: StudioDesignFactsInput): RulesProvenance {
  return {
    collectedAt: input.collectedAt,
    producer: { id: '@ankhorage/studio', version: '8' },
    source: { id: `studio-screen:${input.screenId}`, revision: input.sourceRevision },
  };
}

/*** Create one available fact after preserving the exclusive role-pixel measurement. */
function availableFact(
  scope: Scope,
  provenance: RulesProvenance,
  breakpointId: string,
  measurement: StudioRenderedAreaMeasurement,
): FactEnvelope {
  const value = {
    ...measurement.evidence,
    breakpointId,
    measuredPixels: measurement.measuredPixels,
    rolePixels: measurement.rolePixels,
    scope: measurement.scope,
    scopeId: measurement.scopeId,
    themeId: measurement.themeId,
    unknownPixels: measurement.unknownPixels,
  };
  const fact = {
    id: `${FACT_KIND}:${scope.id}:${breakpointId}:${measurement.scope}:${measurement.scopeId}`,
    kind: FACT_KIND,
    provenance,
    schemaVersion: 1 as const,
    scope,
    status: 'available' as const,
    value,
  };

  return { ...fact, contentHash: contentHash(fact) };
}

/*** Represent unavailable rendered evidence explicitly so Rules cannot infer a pass. */
function missingFact(
  scope: Scope,
  provenance: RulesProvenance,
  breakpointId: string,
  code: 'rendered-area-invalid' | 'rendered-area-unavailable',
): FactEnvelope {
  const fact = {
    id: `${FACT_KIND}:${scope.id}:${breakpointId}:missing`,
    kind: FACT_KIND,
    missing: {
      code,
      message:
        code === 'rendered-area-unavailable'
          ? 'No renderer pixel-area measurement was captured.'
          : 'The renderer pixel-area measurement was incomplete or invalid.',
    },
    provenance,
    schemaVersion: 1 as const,
    scope,
    status: 'missing' as const,
  };

  return { ...fact, contentHash: contentHash(fact) };
}

/*** Accept only non-overlapping, complete renderer pixel counters. */
function isCompleteMeasurement(
  breakpointId: string,
  measurement: StudioRenderedAreaMeasurement,
): boolean {
  const { rolePixels } = measurement;
  const total = rolePixels.base + rolePixels.secondary + rolePixels.accent + rolePixels.unknown;

  return (
    nonEmpty(breakpointId) &&
    nonEmpty(measurement.scopeId) &&
    nonEmpty(measurement.themeId) &&
    nonNegativeInteger(measurement.measuredPixels) &&
    nonNegativeInteger(measurement.unknownPixels) &&
    nonNegativeInteger(rolePixels.base) &&
    nonNegativeInteger(rolePixels.secondary) &&
    nonNegativeInteger(rolePixels.accent) &&
    nonNegativeInteger(rolePixels.unknown) &&
    measurement.measuredPixels > 0 &&
    measurement.measuredPixels === total &&
    measurement.unknownPixels === rolePixels.unknown
  );
}

/*** Keep content hashes deterministic across equivalent serializable fact envelopes. */
function contentHash(value: object): string {
  return `sha256:${createHash('sha256')
    .update(JSON.stringify(sortValue(value)))
    .digest('hex')}`;
}

/*** Sort object keys recursively while retaining semantic array order. */
function sortValue(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(sortValue);
  if (value !== null && typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value)
        .sort(([left], [right]) => left.localeCompare(right))
        .map(([key, nested]) => [key, sortValue(nested)]),
    );
  }

  return value;
}

/*** Require a non-empty stable scoped identifier. */
function nonEmpty(value: string): boolean {
  return value.trim() !== '';
}

/*** Restrict rendered area counters to portable non-negative integer pixels. */
function nonNegativeInteger(value: number): boolean {
  return Number.isSafeInteger(value) && value >= 0;
}
