import { WorkspaceNavigator } from '@ankhorage/navigator/workspace';

import { StudioAdminAccessGate } from './StudioAdminAccessGate';
import { useStudioAdminWorkspace } from './useStudioAdminWorkspace';

/*** Render the complete Studio administration workspace behind its development access boundary. */
export function StudioAdminWorkspaceLayout() {
  return (
    <StudioAdminAccessGate>
      <StudioAdminWorkspaceContent />
    </StudioAdminAccessGate>
  );
}

/*** Bind Studio administration state to Navigator-owned workspace presentation. */
function StudioAdminWorkspaceContent() {
  const workspace = useStudioAdminWorkspace();
  return <WorkspaceNavigator {...workspace} />;
}
