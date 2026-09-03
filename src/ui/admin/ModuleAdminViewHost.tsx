import { ZORA_COMPONENT_META } from '@ankhorage/zora';
import React from 'react';

import { useStudio } from '../../core/StudioContext';
import { executeProjectModuleAdminOperation } from '../../moduleAdminApi';
import { ModuleAdminViewBoundary } from './ModuleAdminViewBoundary';
import type { StudioModuleAdminViewContribution } from './moduleAdminViewRegistry';

/***
 * Adapt one package-owned module admin contribution to Studio project context, operation execution, manifest refresh, and error containment.
 * @todo Keep this as the module-admin inbound UI/composition edge; module operation policy remains in the modules application/domain layer.
 */
export function ModuleAdminViewHost(props: {
  readonly moduleId: string;
  readonly contribution: StudioModuleAdminViewContribution;
}) {
  const { projectId, refetchManifest } = useStudio();
  /*** Execute one module-owned admin operation against the current Studio project and inject canonical component metadata. */
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
  /*** Refresh the Studio manifest after a module contribution reports a project mutation. */
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
