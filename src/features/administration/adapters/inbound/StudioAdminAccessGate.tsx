import { Redirect } from 'expo-router';
import type { ReactNode } from 'react';

/*** Restrict the generated authoring workspace to development builds. */
export function StudioAdminAccessGate({ children }: { readonly children: ReactNode }) {
  if (!__DEV__) return <Redirect href="/" />;
  return children;
}
