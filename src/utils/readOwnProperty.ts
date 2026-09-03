/***
 * Read an own property without traversing the prototype chain and return undefined when absent.
 * @todo Extract to ankhorage/utility/object.
 */
export function readOwnProperty<T>(target: object, key: PropertyKey): T | undefined {
  if (!Object.hasOwn(target, key)) return undefined;
  return Reflect.get(target, key) as T | undefined;
}
