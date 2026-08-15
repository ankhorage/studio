export class ProjectDeployApiError extends Error {
  readonly status: number;

  constructor(message: string, status: number) {
    super(message);
    this.name = 'ProjectDeployApiError';
    this.status = status;
  }
}
