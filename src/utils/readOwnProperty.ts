export function readOwnProperty<T>(target: object, key: PropertyKey): T | undefined {
  if (!Object.hasOwn(target, key)) return undefined;
  return Reflect.get(target, key) as T | undefined;
}
