/***
 * Prevent overlapping asynchronous mutations for the same key while allowing independent keys to proceed.
 * @utility @ankhorage/utility/concurrency
 * @todo Replace this Deploy-specific class with `createKeyedAsyncMutex` after Utility releases.
 */
export class ProjectDeployMutationGuard {
  private readonly activeProjectIds = new Set<string>();

  /***
   * Run one project mutation exclusively for its project id and always release the reservation.
   * @utility @ankhorage/utility/concurrency
   */
  async run<T>(projectId: string, operation: () => Promise<T>): Promise<T> {
    if (this.activeProjectIds.has(projectId)) {
      throw new Error('DEPLOY_RELEASE_MUTATION_IN_PROGRESS');
    }
    this.activeProjectIds.add(projectId);
    try {
      return await operation();
    } finally {
      this.activeProjectIds.delete(projectId);
    }
  }
}
