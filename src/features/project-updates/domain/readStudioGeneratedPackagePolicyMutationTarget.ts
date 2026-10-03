import type { ApmProjectMutation } from '@ankhorage/apm/types';

export type StudioGeneratedPackagePolicyMutationTarget =
  | { readonly section: 'packageManager' }
  | {
      readonly section: 'dependencies' | 'devDependencies';
      readonly name: string;
    };

/*** Parse only JSON-pointer targets owned by Studio's generated package policy. */
export function readStudioGeneratedPackagePolicyMutationTarget(
  mutation: ApmProjectMutation,
): StudioGeneratedPackagePolicyMutationTarget | undefined {
  if (
    mutation.kind !== 'set-json-pointer' &&
    mutation.kind !== 'remove-json-pointer'
  ) {
    return undefined;
  }
  if (mutation.path !== 'package.json') return undefined;
  if (mutation.pointer === '/packageManager') return { section: 'packageManager' };
  const match = /^\/(dependencies|devDependencies)\/([^/]+)$/u.exec(mutation.pointer);
  const section = match?.[1];
  const encodedName = match?.[2];
  if (
    (section !== 'dependencies' && section !== 'devDependencies') ||
    encodedName === undefined
  ) {
    return undefined;
  }
  return {
    section,
    name: encodedName.replaceAll('~1', '/').replaceAll('~0', '~'),
  };
}
