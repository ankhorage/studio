/***
 * Represent a Studio deploy-host request failure together with its HTTP status code.
 * @todo Keep this feature-specific error type beside the deploy client/adapter owner rather than as a direct root module.
 */
export class ProjectDeployApiError extends Error {
  readonly status: number;

  /*** Construct a deploy API error from its human message and HTTP status. */
  constructor(message: string, status: number) {
    super(message);
    this.name = 'ProjectDeployApiError';
    this.status = status;
  }
}
