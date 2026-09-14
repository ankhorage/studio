import type {
  ApmApplyCancellationPort,
  ApmApplyProgressPort,
  ApmApplyStepPort,
  ApmPlanProtocolPort,
  ApmStatusExtensionEvidencePort,
  ApmVerifyStepPort,
} from '@ankhorage/apm/types';

/*** Generated app package shape owned by Studio package policy projection. */
export interface GeneratedPackageManifest {
  readonly packageManager: string;
  readonly dependencies: Readonly<Record<string, string>>;
  readonly devDependencies: Readonly<Record<string, string>>;
}

/*** Studio-owned dependency policy frozen to one exact Studio package artifact. */
export interface GeneratedPackagePolicy {
  readonly ownerVersion: string;
  readonly packageManager: string;
  readonly dependencies: {
    readonly contracts: string;
    readonly dataSources: string;
    readonly expoRuntime: string;
    readonly navigator: string;
    readonly runtime: string;
    readonly studio: string;
    readonly utility: string;
    readonly supabaseAuth: string;
    readonly supabaseStorage: string;
    readonly zora: string;
  };
  readonly devDependencies: {
    readonly ankh: string;
    readonly devtools: string;
    readonly typesBun: string;
    readonly typesCulori: string;
    readonly typesReact: string;
  };
  readonly peerDependencies: {
    readonly nativePicker: string;
    readonly fontawesome: string;
    readonly fontawesome5: string;
    readonly fontawesome6: string;
    readonly ionicons: string;
  };
}

/*** Optional Studio-owned ports composed around the released APM project update lifecycle. */
export interface ProjectUpdateServiceOptions {
  readonly extensions?: ApmStatusExtensionEvidencePort;
  readonly protocol?: ApmPlanProtocolPort;
  readonly applyOwnerStep?: ApmApplyStepPort;
  readonly verifyOwnerStep?: ApmVerifyStepPort;
  readonly progress?: ApmApplyProgressPort;
  readonly cancellation?: ApmApplyCancellationPort;
}
