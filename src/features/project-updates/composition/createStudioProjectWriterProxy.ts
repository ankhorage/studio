import { isRecord } from '@ankhorage/utility/object';

import { runWithStudioProjectWriterLockAsync } from './runWithStudioProjectWriterLockAsync';

interface ProjectWriterProxyOptions {
  readonly owner: string;
  readonly firstArgumentProjectIdMethods: readonly string[];
  readonly objectArgumentProjectIdMethods: readonly string[];
  readonly resolveProjectRoot: (projectId: string) => string;
}

type Callable = (...args: readonly unknown[]) => unknown;

/*** Wrap selected async Studio manager operations with the canonical APM project writer lock. */
export function createStudioProjectWriterProxy<T extends object>(
  target: T,
  options: ProjectWriterProxyOptions,
): T {
  const firstArgumentMethods = new Set(options.firstArgumentProjectIdMethods);
  const objectArgumentMethods = new Set(options.objectArgumentProjectIdMethods);

  return new Proxy(target, {
    get(instance, property, receiver) {
      const value: unknown = Reflect.get(instance, property, receiver);
      if (typeof property !== 'string' || !isCallable(value)) return value;
      if (!firstArgumentMethods.has(property) && !objectArgumentMethods.has(property)) return value;

      return (...args: readonly unknown[]) => {
        const projectId = resolveProjectId(
          property,
          args,
          firstArgumentMethods,
          objectArgumentMethods,
        );
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

/*** Resolve the project id from one configured Studio manager mutation signature. */
function resolveProjectId(
  method: string,
  args: readonly unknown[],
  firstArgumentMethods: ReadonlySet<string>,
  objectArgumentMethods: ReadonlySet<string>,
): string {
  const first = args[0];
  if (firstArgumentMethods.has(method) && typeof first === 'string') return first;
  if (objectArgumentMethods.has(method) && isRecord(first) && typeof first.projectId === 'string') {
    return first.projectId;
  }
  throw new Error(`Studio project writer '${method}' requires a project id.`);
}
