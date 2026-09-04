/*** Create the generated Expo Router route source that exposes the native evidence screen.
 * @todo Move this acceptance-fixture source generator from src/host/smoke to test/smoke/nativeCapabilityEvidence.
 */
export function createNativeEvidenceRouteSource(): string {
  return `export { NativeEvidenceScreen as default } from '@/native-evidence/native-evidence-screen';
`;
}
