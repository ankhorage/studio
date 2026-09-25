import type { MediaAssetKind } from '@ankhorage/contracts';

export interface StudioAuthoringPropSchema {
  readonly type: string;
  readonly category: string;
  readonly label?: string;
  readonly enum?: readonly (string | number)[];
  readonly mediaKinds?: readonly MediaAssetKind[];
  readonly default?: unknown;
  readonly authoring?: {
    readonly authority: string;
  };
}

export interface StudioAuthoringComponentMeta {
  readonly name: string;
  readonly props: Readonly<Record<string, StudioAuthoringPropSchema>>;
}

export type StudioAuthoringMetaRegistry = Readonly<
  Record<string, StudioAuthoringComponentMeta | undefined>
>;
