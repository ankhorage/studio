/*** Describe the module-owned source-layout mutations applied by the Studio host integration. */
export interface LayoutMutation {
  readonly imports: readonly string[];
  readonly hooks: readonly string[];
  readonly providerStart: readonly string[];
  readonly providerEnd: readonly string[];
}
