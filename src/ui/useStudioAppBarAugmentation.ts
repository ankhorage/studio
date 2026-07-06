import type React from 'react';

export interface StudioAppBarAugmentation {
  appMode?: unknown;
  actions?: React.ReactNode;
  overflow?: unknown;
  overlay?: React.ReactNode;
}

export function useStudioAppBarAugmentation(): StudioAppBarAugmentation {
  return {};
}
