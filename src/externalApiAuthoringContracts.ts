import type {
  CredentialRef,
  DataContractValue,
  DataOperationIntent,
  DataSourceDiagnostic,
  DataSourceKind,
} from '@ankhorage/contracts/data';

export type ExternalApiProtocol = 'auto' | 'graphql' | 'openapi';

export interface ExternalApiConnectRequest {
  readonly sourceId: string;
  readonly url: string;
  readonly protocol: ExternalApiProtocol;
  readonly name?: string;
  readonly description?: string;
  readonly credential?: CredentialRef;
}

export interface ManualRestSourceRequest {
  readonly sourceId: string;
  readonly baseUrl: string;
  readonly endpointId: string;
  readonly path: string;
  readonly operationId: string;
  readonly method: string;
  readonly intent: DataOperationIntent;
  readonly name?: string;
  readonly description?: string;
  readonly credential?: CredentialRef;
}

export interface ExternalApiDiscoveryAttempt {
  readonly url: string;
  readonly outcome: string;
  readonly status?: number;
}

export type ExternalApiConnectResult =
  | {
      readonly ok: true;
      readonly sourceId: string;
      readonly kind: DataSourceKind;
      readonly protocol: 'graphql' | 'openapi' | 'rest';
      readonly created: boolean;
      readonly attempts: readonly ExternalApiDiscoveryAttempt[];
      readonly diagnostics: readonly DataSourceDiagnostic[];
    }
  | {
      readonly ok: false;
      readonly attempts: readonly ExternalApiDiscoveryAttempt[];
      readonly diagnostics: readonly DataSourceDiagnostic[];
    };

export interface ExternalApiOperationTestRequest {
  readonly sourceId: string;
  readonly endpointId: string;
  readonly operationId: string;
  readonly values?: Readonly<Record<string, DataContractValue>>;
  readonly dryRun?: boolean;
}

export interface ExternalApiSafeRequestSummary {
  readonly method: string;
  readonly url: string;
  readonly dryRun: boolean;
}

export interface ExternalApiSafeResponseSummary {
  readonly status: number;
  readonly ok: boolean;
}

export type ExternalApiOperationTestResult =
  | {
      readonly ok: true;
      readonly request: ExternalApiSafeRequestSummary;
      readonly response?: ExternalApiSafeResponseSummary;
      readonly data?: DataContractValue;
      readonly diagnostics: readonly DataSourceDiagnostic[];
    }
  | {
      readonly ok: false;
      readonly request?: ExternalApiSafeRequestSummary;
      readonly response?: ExternalApiSafeResponseSummary;
      readonly diagnostics: readonly DataSourceDiagnostic[];
    };
