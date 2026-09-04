import type { ProjectAuthHealth } from '../../../projectAuthHealth';

export type AuthHealthRefreshResult =
  | {
      readonly applied: true;
      readonly health: ProjectAuthHealth;
    }
  | {
      readonly applied: false;
      readonly error?: unknown;
    };

export class AuthHealthRefreshCoordinator {
  private latestRequestId = 0;

  /***
   * Run one asynchronous refresh and apply only the result belonging to the latest request generation.
   * @utility @ankhorage/utility/async
   */
  async refresh(args: {
    readonly loadHealth: () => Promise<ProjectAuthHealth>;
    readonly onHealth: (health: ProjectAuthHealth) => void;
    readonly onError: (error: unknown) => void;
  }): Promise<AuthHealthRefreshResult> {
    const requestId = this.latestRequestId + 1;
    this.latestRequestId = requestId;

    try {
      const health = await args.loadHealth();
      if (!this.isLatest(requestId)) return { applied: false };
      args.onHealth(health);
      return { applied: true, health };
    } catch (error) {
      if (!this.isLatest(requestId)) return { applied: false, error };
      args.onError(error);
      return { applied: false, error };
    }
  }

  /***
   * Return whether a request generation is still the newest generation owned by the coordinator.
   * @utility @ankhorage/utility/async
   */
  private isLatest(requestId: number): boolean {
    return requestId === this.latestRequestId;
  }
}
