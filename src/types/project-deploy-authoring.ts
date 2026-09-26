import type { SerializableValue } from '@ankhorage/contracts';
import type { StructureDescriptorDocument } from '@ankhorage/contracts/structure';

/*** Browser-safe Deploy authoring snapshot projected by the trusted Studio host. */
export interface ProjectDeployAuthoringSnapshot {
  readonly structure: StructureDescriptorDocument;
  readonly monetization: SerializableValue;
  readonly release: SerializableValue;
}
