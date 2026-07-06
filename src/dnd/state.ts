export type StudioDragState = {
  readonly activeNodeId: string | null;
  readonly activeDropZoneId: string | null;
};

export const createIdleStudioDragState = (): StudioDragState => ({
  activeNodeId: null,
  activeDropZoneId: null,
});
