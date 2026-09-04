import type { StudioContextValue, StudioManifest } from '../index';
import { createStudioManifestSignature } from '../manifestSync';

export interface StudioManifestPersistenceCoordinatorOptions {
  readonly projectId: string;
  readonly readManifest: () => StudioManifest | null;
  readonly readLastPersistedSignature: () => string | null;
  readonly setLastPersistedSignature: (signature: string | null) => void;
  readonly saveManifest: (projectId: string, manifest: StudioManifest) => Promise<void>;
  readonly setSaveStatus: (status: StudioContextValue['saveStatus']) => void;
  readonly setError: (message: string | null) => void;
  readonly toErrorMessage: (error: unknown) => string;
}

/***
 * Serialize persistence of the latest Studio manifest while tracking save status and persisted signatures.
 * @todo Move this application-level persistence coordinator out of core into the manifest domain's application responsibility; keep concrete HTTP/filesystem adapters at package edges.
 */
export class StudioManifestPersistenceCoordinator {
  private readonly options: StudioManifestPersistenceCoordinatorOptions;
  private queue: Promise<void> = Promise.resolve();

  /*** Create a persistence coordinator around the supplied manifest access and save adapters. */
  constructor(options: StudioManifestPersistenceCoordinatorOptions) {
    this.options = options;
  }

  /*** Queue persistence of the newest manifest state after any already queued save work. */
  queueLatestSave(): Promise<void> {
    return this.enqueueLatestSave();
  }

  /*** Wait until the newest manifest state has been persisted through the shared save queue. */
  flushLatestSave(): Promise<void> {
    return this.enqueueLatestSave();
  }

  /*** Append one latest-state persistence task to the serialized save queue. */
  private enqueueLatestSave(): Promise<void> {
    const task = this.queue.catch(() => undefined).then(() => this.persistLatestUntilSettled());
    this.queue = task.catch(() => undefined);
    return task;
  }

  /*** Persist manifest revisions until the stored signature matches the latest in-memory state. */
  private async persistLatestUntilSettled(): Promise<void> {
    for (;;) {
      const manifest = this.options.readManifest();
      if (!manifest) return;

      const signature = createStudioManifestSignature(manifest);
      if (signature === this.options.readLastPersistedSignature()) return;

      this.options.setSaveStatus('saving');
      try {
        await this.options.saveManifest(this.options.projectId, manifest);
      } catch (error) {
        this.options.setError(this.options.toErrorMessage(error));
        this.options.setSaveStatus('error');
        throw error;
      }

      this.options.setLastPersistedSignature(signature);
      this.options.setError(null);
      this.options.setSaveStatus('saved');

      const currentManifest = this.options.readManifest();
      if (!currentManifest || createStudioManifestSignature(currentManifest) === signature) {
        return;
      }
    }
  }
}
