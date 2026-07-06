import React from 'react';

import { useStudio } from '../core/StudioContext';

export interface AnkhStudioProps {
  children: React.ReactNode;
  runtimeRegistry?: unknown;
  runtimeConfig?: unknown;
}

export const AnkhStudio = ({ children }: AnkhStudioProps) => {
  const studio = useStudio();

  if (studio.error) {
    return React.createElement(React.Fragment, null, studio.error);
  }

  if (studio.isLoading || !studio.manifest) {
    return null;
  }

  return React.createElement(React.Fragment, null, children);
};
