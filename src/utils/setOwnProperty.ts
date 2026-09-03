/*** Define an enumerable, writable, configurable own data property on an object. */
export function setOwnProperty(target: object, key: PropertyKey, value: unknown): void {
  Object.defineProperty(target, key, {
    configurable: true,
    enumerable: true,
    value,
    writable: true,
  });
}
