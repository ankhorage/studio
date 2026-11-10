import { Card, ListItem, ListSection, Text } from '@ankhorage/zora/reader-free';
import React from 'react';

import { createStudioDesignAssessmentPresentation } from './createStudioDesignAssessmentPresentation';
import type { StudioDesignAssessment } from './evaluateStudioDesignAssessment';

interface StudioDesignAssessmentCardProps {
  readonly assessment: StudioDesignAssessment;
}

/*** Display canonical advisory Design outcomes while keeping page, viewport, and scroll evidence separate. */
export function StudioDesignAssessmentCard({ assessment }: StudioDesignAssessmentCardProps) {
  const presentation = createStudioDesignAssessmentPresentation(assessment);
  const status = presentation.resultStatuses.join(', ') || 'INCOMPLETE';

  return (
    <Card
      title="Design assessment"
      description={`${presentation.profileId} is advisory; viewport and scroll findings do not turn a page finding into a blocking result.`}
    >
      <Text weight="semiBold">Canonical status: {status}</Text>
      {presentation.diagnostics.map((diagnostic) => (
        <Text key={diagnostic} color="danger" variant="bodySmall">
          {diagnostic}
        </Text>
      ))}
      {presentation.groups.map((group) => (
        <ListSection key={group.scope} title={formatScope(group.scope)}>
          {group.facts.length === 0 ? (
            <ListItem
              title="INCOMPLETE"
              description="No renderer fact was captured for this evidence scope."
              variant="card"
            />
          ) : (
            group.facts.map((fact) => (
              <ListItem
                key={fact.id}
                title={fact.status === 'available' ? 'Captured renderer fact' : 'INCOMPLETE'}
                description={
                  fact.status === 'available'
                    ? `Provenance: ${fact.provenance.producer.id}@${fact.provenance.producer.version}`
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
