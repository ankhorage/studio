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

  private isLatest(requestId: number): boolean {
    return requestId === this.latestRequestId;
  }
}
