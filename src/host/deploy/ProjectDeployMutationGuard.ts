export class ProjectDeployMutationGuard {
  private readonly activeProjectIds = new Set<string>();

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
