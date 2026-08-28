export function assertNoBrowserErrors(issues: readonly string[], label: string): void {
  const unexpectedIssues = issues.filter((issue) => !isKnownReactNativeWebWarning(issue));
  if (unexpectedIssues.length === 0) return;

  const source = unexpectedIssues.join('\n');
  const renderMismatch = REACT_RENDER_MISMATCH_PATTERNS.find((pattern) =>
    source.toLowerCase().includes(pattern),
  );
  const classification = renderMismatch
    ? `React hydration/recoverable-render mismatch (${renderMismatch})`
    : 'browser exception, console error/warning/assertion, browser log error/warning, or failed asset request';
  throw new Error(`${label} reported ${classification}:\n${source}`);
}

const REACT_RENDER_MISMATCH_PATTERNS = [
  'hydration failed',
  'hydrated but some attributes',
  'text content did not match',
  'there was an error while hydrating',
  'recoverable hydration error',
] as const;

const KNOWN_REACT_NATIVE_WEB_WARNING_HEADERS = new Set([
  '[console.warning] "props.pointerEvents is deprecated. Use style.pointerEvents"',
  '[console.warning] "\\"shadow*\\" style props are deprecated. Use \\"boxShadow\\"."',
  '[console.warning] "\\"textShadow*\\" style props are deprecated. Use \\"textShadow\\"."',
]);

function isKnownReactNativeWebWarning(issue: string): boolean {
  const [header] = issue.split('\n', 1);
  return header !== undefined && KNOWN_REACT_NATIVE_WEB_WARNING_HEADERS.has(header);
}
