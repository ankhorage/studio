/*** Trusted host boundary for observing and executing one published Orchestrator module removal. */
export interface StudioPendingModuleLifecyclePort {
  readonly isModuleInstalledAsync: (rootPath: string, moduleId: string) => Promise<boolean | undefined>;
  readonly removeModuleAsync: (rootPath: string, moduleId: string) => Promise<void>;
}
