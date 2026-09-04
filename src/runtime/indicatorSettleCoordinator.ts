import {
  createSettleCoordinator,
  type SettleCoordinator as IndicatorSettleCoordinator,
  type SettleCoordinatorOptions as IndicatorSettleCoordinatorOptions,
} from '@ankhorage/utility/scheduling';

export type { IndicatorSettleCoordinator, IndicatorSettleCoordinatorOptions };

/*** Adapt Studio's indicator settle contract to the canonical scheduling utility. */
export function createIndicatorSettleCoordinator<Snapshot, Handle>(
  options: IndicatorSettleCoordinatorOptions<Snapshot, Handle>,
): IndicatorSettleCoordinator {
  return createSettleCoordinator(options);
}
