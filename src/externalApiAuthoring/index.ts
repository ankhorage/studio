/***
 * External-API authoring public subpath entrypoint. Intentionally contains exports only; contracts and implementations remain in their owning modules.
 */
export type {
  ExternalApiConnectRequest,
  ExternalApiConnectResult,
  ExternalApiDiscoveryAttempt,
  ExternalApiOperationTestRequest,
  ExternalApiOperationTestResult,
  ExternalApiProtocol,
  ManualRestApiRequest,
} from '../externalApiAuthoringContracts';
export { type ExternalApiIdResult, normalizeExternalApiId } from '../normalizeExternalApiId';
export { type ExternalApiUpsertResult, upsertExternalApi } from '../upsertExternalApi';
