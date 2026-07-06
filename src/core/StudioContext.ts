import { createContext, useContext } from 'react';

import type { StudioContextValue } from '../index';

export type { StudioAdminRoutePath, StudioPanelId, ThemeUpdates } from '../index';
export type StudioContextType = StudioContextValue;

export const StudioContext = createContext<StudioContextType | undefined>(undefined);

export const useStudio = () => {
  const context = useContext(StudioContext);
  if (!context) {
    throw new Error('useStudio must be used within a StudioProvider');
  }
  return context;
};
