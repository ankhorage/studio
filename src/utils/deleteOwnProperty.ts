export function deleteOwnProperty(target: object, key: PropertyKey): boolean {
  return Object.hasOwn(target, key) && Reflect.deleteProperty(target, key);
}
