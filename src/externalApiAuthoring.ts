export type {
  ExternalApiConnectRequest,
  ExternalApiConnectResult,
  ExternalApiDiscoveryAttempt,
  ExternalApiOperationTestRequest,
  ExternalApiOperationTestResult,
  ExternalApiProtocol,
  ManualRestSourceRequest,
} from './externalApiAuthoringContracts';
export {
  normalizeExternalApiSourceId,
  type ExternalApiSourceIdResult,
} from './normalizeExternalApiSourceId';
export {
  type ExternalApiDataSourceUpsertResult,
  upsertExternalApiDataSource,
} from './upsertExternalApiDataSource';
