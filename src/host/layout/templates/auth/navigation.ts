export function getAuthNavigationTsx() {
  return `import { createContext, type ReactNode, useContext } from 'react';

export type GeneratedAuthNavigationState = 'pending' | 'unauthenticated' | 'authenticated';

const GeneratedAuthNavigationStateContext =
  createContext<GeneratedAuthNavigationState>('pending');

export function GeneratedAuthNavigationProvider({
  state,
  children,
}: {
  state: GeneratedAuthNavigationState;
  children: ReactNode;
}) {
  return (
    <GeneratedAuthNavigationStateContext.Provider value={state}>
      {children}
    </GeneratedAuthNavigationStateContext.Provider>
  );
}

export function useGeneratedAuthNavigationState(): GeneratedAuthNavigationState {
  return useContext(GeneratedAuthNavigationStateContext);
}
`;
}
