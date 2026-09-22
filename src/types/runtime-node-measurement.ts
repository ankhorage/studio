/*** Shared geometry contracts between runtime measurement and Studio canvas rendering. */
export interface MeasuredRect {
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly height: number;
}

export interface RuntimeNodeIndicatorRect extends MeasuredRect {
  readonly nodeId: string;
  readonly showUnsupportedIndicator: boolean;
}
