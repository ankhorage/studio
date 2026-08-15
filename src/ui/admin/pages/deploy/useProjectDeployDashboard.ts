import { useCallback, useEffect, useState } from 'react';

import {
  listProjectDeployReleaseHistory,
  readProjectDeployConfig,
  readProjectDeployListing,
  readProjectDeployMonetization,
  readProjectDeployRelease,
} from '../../../../projectDeployApi';
import type { DeployLoadable, ProjectDeployDashboardState } from './deployDashboardTypes';

export function useProjectDeployDashboard(projectId: string) {
  const [refreshGeneration, setRefreshGeneration] = useState(0);
  const [state, setState] = useState<ProjectDeployDashboardState>(loadingState);

  useEffect(() => {
    let cancelled = false;
    setState(loadingState);
    void loadDashboard(projectId).then((next) => {
      if (!cancelled) setState(next);
    });
    return () => {
      cancelled = true;
    };
  }, [projectId, refreshGeneration]);

  const refresh = useCallback(() => {
    setRefreshGeneration((current) => current + 1);
  }, []);

  return { state, refresh };
}

const loadingState: ProjectDeployDashboardState = {
  config: { status: 'loading' },
  listing: { status: 'loading' },
  monetization: { status: 'loading' },
  release: { status: 'loading' },
  history: { status: 'loading' },
};

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

async function capture<T>(operation: Promise<T>): Promise<DeployLoadable<T>> {
  try {
    return { status: 'ready', data: await operation };
  } catch (error) {
    return { status: 'error', message: error instanceof Error ? error.message : String(error) };
  }
}
