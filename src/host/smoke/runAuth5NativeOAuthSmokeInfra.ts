/*** CLI smoke script for activating Auth 5 native OAuth infrastructure and printing redacted verification instructions.
 * @todo Move this smoke CLI entry from src/host/smoke to test/smoke or a dedicated test script edge.
 */
import path from 'node:path';

import { prepareAuth5NativeOAuthSmokeInfra } from './prepareAuth5NativeOAuthSmokeInfra';

const [workspaceArg, credentialsFlag, credentialsProjectArg, ...extraArgs] = process.argv.slice(2);
if (
  !workspaceArg ||
  credentialsFlag !== '--credentials-project' ||
  !credentialsProjectArg?.trim() ||
  extraArgs.length > 0
) {
  throw new Error(
    'Usage: bun scripts/auth5-native-oauth-smoke-infra.ts <smoke-workspace-path> --credentials-project <configured-project-id>',
  );
}

const result = await prepareAuth5NativeOAuthSmokeInfra({
  credentialsProjectId: credentialsProjectArg.trim(),
  smokeWorkspaceRoot: path.resolve(workspaceArg),
  sourceWorkspaceRoot: process.cwd(),
});
const gateway = new URL(result.gatewayUrl);
const gatewayPort = gateway.port;

console.log(
  [
    `Auth 5 native OAuth smoke Infra is active for '${result.projectId}'.`,
    `Target: ${result.target}`,
    `Gateway: ${result.gatewayUrl}`,
    `Android callback: ${result.androidCallback}`,
    `iOS callback: ${result.iosCallback}`,
    '',
    'The generated app .env.local now contains only the public Supabase URL and anon key.',
    '',
    'Verify active GoTrue redirects:',
    "  kubectl exec -n supabase deploy/auth -- printenv | grep -E 'GOTRUE_(SITE_URL|URI_ALLOW_LIST)'",
    ...(gatewayPort
      ? ['', 'Android local-backend bridge:', `  adb reverse tcp:${gatewayPort} tcp:${gatewayPort}`]
      : []),
  ].join('\n'),
);
