export function getChromeNavigationIssue(
  method: string | undefined,
  params: unknown,
): string | null {
  if (!isRecord(params)) return null;

  if (method === 'Runtime.consoleAPICalled') {
    return formatConsoleApiIssue(params);
  }

  if (method === 'Runtime.exceptionThrown') {
    return formatExceptionIssue(params);
  }

  if (method === 'Log.entryAdded') {
    return formatLogIssue(params);
  }

  if (method === 'Network.loadingFailed') {
    return formatNetworkFailure(params);
  }

  if (method === 'Network.responseReceived') {
    return formatFailedNetworkResponse(params);
  }

  return null;
}

function formatFailedNetworkResponse(params: Record<string, unknown>): string | null {
  const response = isRecord(params.response) ? params.response : undefined;
  if (!response || typeof response.status !== 'number' || response.status < 400) return null;
  const url = readString(response, 'url') ?? '<unknown URL>';
  if (new URL(url, 'http://localhost').pathname === '/favicon.ico') return null;
  return `[network response] ${response.status} ${url}`;
}

function formatNetworkFailure(params: Record<string, unknown>): string | null {
  if (params.canceled === true) return null;
  const errorText = readString(params, 'errorText') ?? 'Network request failed';
  return `[network failure] ${errorText}`;
}

function formatConsoleApiIssue(params: Record<string, unknown>): string | null {
  const type = readString(params, 'type');
  if (type !== 'error' && type !== 'warning' && type !== 'assert') return null;

  const args = Array.isArray(params.args)
    ? params.args.map((argument) => formatRemoteObject(argument)).filter(Boolean)
    : [];
  const stackTrace = formatStackTrace(params.stackTrace);
  const message = [`[console.${type}]`, args.join(' ')].filter(Boolean).join(' ');
  return stackTrace ? `${message}\n${stackTrace}` : message;
}

function formatExceptionIssue(params: Record<string, unknown>): string {
  const details = isRecord(params.exceptionDetails) ? params.exceptionDetails : params;
  const text = readString(details, 'text') ?? 'Unhandled browser exception';
  const exception = formatRemoteObject(details.exception);
  const url = readString(details, 'url');
  const lineNumber = typeof details.lineNumber === 'number' ? details.lineNumber + 1 : undefined;
  const columnNumber =
    typeof details.columnNumber === 'number' ? details.columnNumber + 1 : undefined;
  const location = url
    ? `${url}${lineNumber === undefined ? '' : `:${lineNumber}:${columnNumber ?? 1}`}`
    : '';
  const stackTrace = formatStackTrace(details.stackTrace);
  return ['[uncaught exception]', text, exception, location, stackTrace].filter(Boolean).join(' ');
}

function formatLogIssue(params: Record<string, unknown>): string | null {
  const entry = isRecord(params.entry) ? params.entry : params;
  const level = readString(entry, 'level');
  if (level !== 'error' && level !== 'warning') return null;

  const source = readString(entry, 'source') ?? 'browser';
  const text = readString(entry, 'text') ?? 'Browser log entry';
  const url = readString(entry, 'url');
  const lineNumber = typeof entry.lineNumber === 'number' ? entry.lineNumber : undefined;
  const location = url ? `${url}${lineNumber === undefined ? '' : `:${lineNumber}`}` : '';
  const stackTrace = formatStackTrace(entry.stackTrace);
  return [`[${source} ${level}]`, text, location, stackTrace].filter(Boolean).join(' ');
}

function formatPrimitive(value: unknown): string {
  if (typeof value === 'string') return JSON.stringify(value);
  if (typeof value === 'number' || typeof value === 'boolean' || typeof value === 'bigint') {
    return String(value);
  }
  if (value === null) return 'null';
  if (value === undefined) return 'undefined';
  return '';
}

function formatRemoteObject(value: unknown): string {
  if (!isRecord(value)) return formatPrimitive(value);

  if (Object.hasOwn(value, 'value')) {
    const primitive = formatPrimitive(value.value);
    return primitive || JSON.stringify(value.value);
  }

  return (
    readString(value, 'unserializableValue') ??
    readString(value, 'description') ??
    readString(value, 'type') ??
    ''
  );
}

function formatStackTrace(value: unknown): string {
  if (!isRecord(value) || !Array.isArray(value.callFrames)) return '';

  const frames = value.callFrames.flatMap((frame) => {
    if (!isRecord(frame)) return [];
    const functionName = readString(frame, 'functionName') ?? '<anonymous>';
    const url = readString(frame, 'url') ?? '<unknown>';
    const lineNumber = typeof frame.lineNumber === 'number' ? frame.lineNumber + 1 : 1;
    const columnNumber = typeof frame.columnNumber === 'number' ? frame.columnNumber + 1 : 1;
    return [`at ${functionName} (${url}:${lineNumber}:${columnNumber})`];
  });

  return frames.length > 0 ? frames.join('\n') : '';
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function readString(record: Readonly<Record<string, unknown>>, key: string): string | undefined {
  const value = Object.entries(record).find(([candidate]) => candidate === key)?.[1];
  return typeof value === 'string' ? value : undefined;
}
