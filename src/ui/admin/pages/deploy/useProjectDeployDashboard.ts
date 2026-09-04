import { useCallback, useEffect, useState } from 'react';

import {
  listProjectDeployReleaseHistory,
  readProjectDeployConfig,
  readProjectDeployListing,
  readProjectDeployMonetization,
  readProjectDeployRelease,
} from '../../../../projectDeployApi';
import type { DeployLoadable, ProjectDeployDashboardState } from './deployDashboardTypes';

interface LoadedDashboardState {
  requestKey: string;
  state: ProjectDeployDashboardState;
}

/***
 * Load the five deploy-dashboard resources for one project, invalidate stale generations, and expose an explicit refresh trigger.
 * @todo Keep this React adapter at the deploy admin UI edge while dashboard loading/orchestration moves into deploy application ownership.
 */
export function useProjectDeployDashboard(projectId: string) {
  const [refreshGeneration, setRefreshGeneration] = useState(0);
  const [loaded, setLoaded] = useState<LoadedDashboardState | null>(null);
  const requestKey = `${projectId}:${refreshGeneration}`;

  useEffect(() => {
    let cancelled = false;
    void loadDashboard(projectId).then((state) => {
      if (!cancelled) setLoaded({ requestKey, state });
    });
    return () => {
      cancelled = true;
    };
  }, [projectId, requestKey]);

  /*** Increment the request generation so the hook reloads all dashboard resources. */
  const refresh = useCallback(() => {
    setRefreshGeneration((current) => current + 1);
  }, []);

  const state = loaded?.requestKey === requestKey ? loaded.state : loadingState;
  return { state, refresh };
}

const loadingState: ProjectDeployDashboardState = {
  config: { status: 'loading' },
  listing: { status: 'loading' },
  monetization: { status: 'loading' },
  release: { status: 'loading' },
  history: { status: 'loading' },
};

/*** Load all deploy-dashboard resources concurrently while isolating each resource failure into its own loadable state. */
async function loadDashboard(projectId: string): Promise<ProjectDeployDashboardState> {
  const [config, listing, monetization, release, history] = await Promise.all([
    capture(readProjectDeployConfig(projectId)),
    capture(readProjectDeployListing(projectId)),
    capture(readProjectDeployMonetization(projectId)),
    capture(readProjectDeployRelease(projectId)),
    capture(listProjectDeployReleaseHistory(projectId)),
  ]);
  return { config, listing, monetization, release, history };
}

/***
 * Convert a promise into a discriminated ready/error loadable result while normalizing unknown errors to messages.
 * @utility @ankhorage/utility/async
 */
async function capture<T>(operation: Promise<T>): Promise<DeployLoadable<T>> {
  try {
    return { status: 'ready', data: await operation };
  } catch (error) {
    return { status: 'error', message: error instanceof Error ? error.message : String(error) };
  }
}
