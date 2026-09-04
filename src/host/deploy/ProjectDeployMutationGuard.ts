import { createKeyedAsyncMutex } from '@ankhorage/utility/concurrency';

/*** Adapt the canonical keyed mutex to Studio's Deploy-specific concurrent-mutation error. */
export class ProjectDeployMutationGuard {
  private readonly mutex = createKeyedAsyncMutex({
    createBusyError: () => new Error('DEPLOY_RELEASE_MUTATION_IN_PROGRESS'),
  });

  /***
   * Run one project mutation exclusively for its project id.
   */
  async run<T>(projectId: string, operation: () => Promise<T>): Promise<T> {
    return this.mutex.run(projectId, operation);
  }
}
