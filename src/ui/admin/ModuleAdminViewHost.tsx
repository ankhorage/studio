import { ZORA_COMPONENT_META } from '@ankhorage/zora';
import React from 'react';

import { useStudio } from '../../core/StudioContext';
import { executeProjectModuleAdminOperation } from '../../moduleAdminApi';
import { ModuleAdminViewBoundary } from './ModuleAdminViewBoundary';
import type { StudioModuleAdminViewContribution } from './moduleAdminViewRegistry';

export function ModuleAdminViewHost(props: {
  readonly moduleId: string;
  readonly contribution: StudioModuleAdminViewContribution;
}) {
  const { projectId, refetchManifest } = useStudio();
  const execute = React.useCallback(
    async (operation: string, input?: unknown) =>
      await executeProjectModuleAdminOperation({
        projectId,
        moduleId: props.moduleId,
        operation,
        ...(input === undefined ? {} : { input }),
        componentMeta: ZORA_COMPONENT_META,
      }),
    [projectId, props.moduleId],
  );
  const onProjectChange = React.useCallback(async () => {
    await refetchManifest();
  }, [refetchManifest]);
  const View = props.contribution.View;

  return (
    <ModuleAdminViewBoundary moduleId={props.moduleId}>
      <View execute={execute} onProjectChange={onProjectChange} />
    </ModuleAdminViewBoundary>
  );
}
