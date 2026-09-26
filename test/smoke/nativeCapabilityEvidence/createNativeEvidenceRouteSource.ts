/*** Create the generated Expo Router route source that exposes the native evidence screen.
 */
export function createNativeEvidenceRouteSource(): string {
  return `export { NativeEvidenceScreen as default } from '@/native-evidence/native-evidence-screen';
`;
}
