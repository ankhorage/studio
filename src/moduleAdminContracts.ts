/** Package-owned control identifier interpreted through Studio's generic scalar/list/JSON model. */
export type StudioModuleAdminControl = string;

export interface StudioModuleAdminField {
  readonly key: string;
  readonly label: string;
  readonly control: StudioModuleAdminControl;
  readonly required: boolean;
}

export interface StudioModuleAdminContribution {
  readonly kind: 'config-schema';
  readonly title: string;
  readonly description: string;
  readonly fields: readonly StudioModuleAdminField[];
}

export interface StudioModuleState {
  readonly id: string;
  readonly name: string;
  readonly description: string;
  readonly available: boolean;
  readonly installed: boolean;
  readonly pendingRemoval: boolean;
  readonly registrationVersion?: string;
  readonly installedVersion?: string;
  readonly installedAt?: string;
  readonly dependencies: readonly string[];
  readonly dependents: readonly string[];
  readonly config: unknown;
  readonly admin: StudioModuleAdminContribution | null;
  readonly adminError?: string;
}

export interface StudioModuleOperationResult {
  readonly success: true;
  readonly module: StudioModuleState | null;
  readonly needsReload: boolean;
  readonly pending?: boolean;
  readonly installed?: readonly string[];
  readonly reconfigured?: string;
}
