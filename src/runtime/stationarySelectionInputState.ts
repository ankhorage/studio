import type {
  StationaryPointerInput,
  StationarySelectionInput,
  StationarySelectionInputState as UtilityStationarySelectionInputState,
  StationaryTouchInput,
} from '@ankhorage/utility/interaction';

export { createStationarySelectionInputState } from '@ankhorage/utility/interaction';
export type { StationaryPointerInput, StationarySelectionInput, StationaryTouchInput };
export type StationarySelectionInputState = UtilityStationarySelectionInputState<string>;
