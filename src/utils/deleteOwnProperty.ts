/***
 * Delete an own property when present and report whether the own-property deletion succeeded.
 * @todo Extract to ankhorage/utility/object.
 */
export function deleteOwnProperty(target: object, key: PropertyKey): boolean {
  return Object.hasOwn(target, key) && Reflect.deleteProperty(target, key);
}
