import { Card, ListItem, ListSection, Text } from '@ankhorage/zora/reader-free';
import React from 'react';

import { createStudioDesignAssessmentPresentation } from '../features/design-facts/adapters/inbound/createStudioDesignAssessmentPresentation.js';
import type { StudioDesignAssessment } from '../features/design-facts/adapters/inbound/evaluateStudioDesignAssessment.js';

export interface StudioDesignAssessmentCardProps {
  readonly assessment: StudioDesignAssessment;
}

/*** Display canonical Rules results and renderer evidence without deriving an outcome in the UI. */
export function StudioDesignAssessmentCard({ assessment }: StudioDesignAssessmentCardProps) {
  const presentation = createStudioDesignAssessmentPresentation(assessment);

  return (
    <Card title="Design assessment" description={`Profile: ${presentation.profileId}`}>
      <Text weight="semiBold">Provider configuration</Text>
      <Text variant="bodySmall">{JSON.stringify(assessment.providerOptions)}</Text>
      <ListSection title="Canonical rule results">
        {assessment.evaluation.results.map((result) => (
          <ListItem
            key={`${result.rule.id}@${result.rule.version}`}
            title={`${result.status}: ${result.rule.id}@${result.rule.version}`}
            description={
              result.diagnostics.map((diagnostic) => diagnostic.message).join(' ') ||
              'Evaluated without diagnostics.'
            }
            meta={result.scope.id}
            variant="card"
          />
        ))}
      </ListSection>
      <ListSection title="Diagnostics">
        {presentation.diagnostics.length === 0 ? (
          <ListItem
            title="None"
            description="Rules emitted no evaluation diagnostics."
            variant="card"
          />
        ) : (
          presentation.diagnostics.map((diagnostic) => (
            <ListItem key={diagnostic} title="Diagnostic" description={diagnostic} variant="card" />
          ))
        )}
      </ListSection>
      {presentation.groups.map((group) => (
        <ListSection key={group.scope} title={formatScope(group.scope)}>
          {group.facts.length === 0 ? (
            <ListItem
              title="Evidence unavailable"
              description="No renderer fact was captured for this evidence scope."
              variant="card"
            />
          ) : (
            group.facts.map((fact) => (
              <ListItem
                key={fact.id}
                title={
                  fact.status === 'available' ? 'Captured renderer fact' : 'Evidence unavailable'
                }
                description={
                  fact.status === 'available'
                    ? `Provenance: ${fact.provenance.producer.id}@${fact.provenance.producer.version}; source revision: ${fact.provenance.source.revision ?? 'unknown'}`
                    : fact.missing.message
                }
                meta={fact.contentHash}
                variant="card"
              />
            ))
          )}
          {group.findings.map((finding, index) => (
            <ListItem
              key={`${finding.ruleId}:${index}`}
              title={`FAIL: ${finding.ruleId}`}
              description={finding.message}
              meta={finding.severity}
              variant="card"
            />
          ))}
        </ListSection>
      ))}
    </Card>
  );
}

/*** Format one frozen evidence scope as a readable Studio section title. */
function formatScope(scope: 'page' | 'scroll-sample' | 'viewport'): string {
  if (scope === 'scroll-sample') return 'Scroll samples';
  return scope.charAt(0).toUpperCase() + scope.slice(1);
}
