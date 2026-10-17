import type { PendingModuleLifecycleState } from '../../../domain/pendingModuleLifecycleState';

export type PendingModuleLifecycleReadResult =
  | { readonly state: 'absent' }
  | {
      readonly state: 'valid';
      readonly value: PendingModuleLifecycleState;
      readonly content: string;
      readonly digest: string;
    }
  | { readonly state: 'invalid'; readonly content: string; readonly digest: string }
  | { readonly state: 'unreadable'; readonly reason: string };

/*** Read immutable pending-module lifecycle evidence for planning. */
export interface PendingModuleLifecycleStatePort {
  readonly readPendingModuleLifecycleStateAsync: (
    rootPath: string,
  ) => Promise<PendingModuleLifecycleReadResult>;
}
