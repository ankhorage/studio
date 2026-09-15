import { isRecord } from '@ankhorage/utility/object';

import { runWithStudioProjectWriterLockAsync } from './runWithStudioProjectWriterLockAsync';

interface ProjectWriterProxyOptions {
  readonly owner: string;
  readonly methods: readonly string[];
  readonly resolveProjectRoot: (projectId: string) => string;
}

type Callable = (...args: unknown[]) => unknown;

/*** Wrap selected async Studio manager operations with the canonical APM project writer lock. */
export function createStudioProjectWriterProxy<T extends object>(
  target: T,
  options: ProjectWriterProxyOptions,
): T {
  const methods = new Set(options.methods);

  return new Proxy(target, {
    get(instance, property, receiver) {
      const value: unknown = Reflect.get(instance, property, receiver);
      if (typeof property !== 'string' || !isCallable(value) || !methods.has(property))
        return value;

      return (...args: unknown[]) => {
        const projectId = resolveProjectId(property, args);
        const rootPath = options.resolveProjectRoot(projectId);
        return runWithStudioProjectWriterLockAsync(
          rootPath,
          `${options.owner}.${property}`,
          async () => await value.apply(instance, args),
        );
      };
    },
  });
}

/*** Narrow an unknown property to a callable manager method. */
function isCallable(value: unknown): value is Callable {
  return typeof value === 'function';
}

/*** Resolve the project id from the two supported Studio manager mutation signatures. */
function resolveProjectId(method: string, args: readonly unknown[]): string {
  const [first] = args;
  if (typeof first === 'string') return first;
  if (isRecord(first) && typeof first.projectId === 'string') return first.projectId;
  throw new Error(`Studio project writer '${method}' requires a project id.`);
}
