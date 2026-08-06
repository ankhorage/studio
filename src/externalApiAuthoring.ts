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
  type ExternalApiSourceIdResult,
  normalizeExternalApiSourceId,
} from './normalizeExternalApiSourceId';
export {
  type ExternalApiDataSourceUpsertResult,
  upsertExternalApiDataSource,
} from './upsertExternalApiDataSource';
