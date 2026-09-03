/***
 * Delete an own property when present and report whether the deletion succeeded.
 * @utility @ankhorage/utility/object
 */
export function deleteOwnProperty(target: object, key: PropertyKey): boolean {
  return Object.hasOwn(target, key) && Reflect.deleteProperty(target, key);
}
