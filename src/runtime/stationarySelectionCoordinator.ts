import type {
  CommitSelectionResult,
  InteractionSelectionTransaction,
  StationarySelectionCoordinator as UtilityStationarySelectionCoordinator,
} from '@ankhorage/utility/interaction';

export { createStationarySelectionCoordinator } from '@ankhorage/utility/interaction';
export type { CommitSelectionResult };
export type TransactionState = InteractionSelectionTransaction<string>;
export type StationarySelectionCoordinator = UtilityStationarySelectionCoordinator<string>;
