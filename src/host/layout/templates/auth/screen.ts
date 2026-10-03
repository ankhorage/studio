import type { GeneratedOAuthProviderPlan } from '../../auth/resolveAuthLayoutPlan';
import { escapeStringLiteral } from '../../utils/escapeStringLiteral';
import { toSafeComponentName } from '../utils/strings';

interface AuthScreenTemplateArgs {
  initialMode: 'signIn' | 'signUp';
  screenName: string;
  title?: string;
  signInRoute: string;
  signUpRoute: string;
  postSignInRoute: string;
  signInIdentifiers: string[];
  signUpRequiredFields: string[];
  signUpOptionalFields: string[];
  signUpPolicy: 'autoSignIn' | 'requireVerification';
  oauthProviders?: readonly GeneratedOAuthProviderPlan[];
}

/*** Generate the thin route component that binds a generated auth screen to its initial mode and title. */
export function getAuthScreenTsx(args: AuthScreenTemplateArgs) {
  const safeName = toSafeComponentName(args.screenName);
  return `import { GeneratedAuthScreen } from '@/screens/auth-screen';

export default function ${safeName}Screen() {
  return <GeneratedAuthScreen initialMode="${args.initialMode}" title="${escapeStringLiteral(args.title ?? args.screenName)}" />;
}
`;
}

/*** Generate the thin application binding between generated auth orchestration and ZORA-owned auth presentation. */
export function getAuthScreenRuntimeTsx(
  args: Omit<AuthScreenTemplateArgs, 'initialMode' | 'screenName' | 'title'>,
) {
  const oauthEnabled = (args.oauthProviders?.length ?? 0) > 0;
  const oauthImports = oauthEnabled
    ? `import { generatedOAuthProviderItems } from '@/auth/oauth';\n`
    : '';
  const oauthProps = oauthEnabled ? getOAuthProviderPropsSource() : '';

  return `import type { AppManifest } from '@ankhorage/contracts';
import { ManifestProvider } from '@ankhorage/runtime';
import { AuthScreen } from '@ankhorage/zora';
import ankhConfig from '@root/ankh.config.json';
import { Stack } from 'expo-router';

${oauthImports}import { type AuthMode, useAuthScreenController } from '@/auth/screen-controller';

const fallbackManifest = ankhConfig as unknown as AppManifest;

export function GeneratedAuthScreen({
  initialMode,
  title,
}: {
  initialMode: AuthMode;
  title: string;
}) {
  const controller = useAuthScreenController(initialMode);
  return (
    <ManifestProvider manifest={fallbackManifest}>
      <Stack.Screen options={{ title }} />
      <AuthScreen
        authMode={controller.mode}
        description={controller.identifierField.helper}
        error={controller.error}
        identifierLabel={controller.identifierField.label}
        identifiers={controller.authIdentifiers}
        info={controller.info}
        loading={controller.loading || controller.oauthLoadingProvider !== null}
        onModeChange={controller.showMode}
        onOAuthProviderPress={controller.handleOAuthProviderPress}
        onSignInSubmit={controller.handleSignInSubmit}
        onSignUpSubmit={controller.handleSignUpSubmit}
        signUpFields={controller.signUpFields}${oauthProps}
      />
    </ManifestProvider>
  );
}
`;
}

/*** Render generated OAuth provider state as ZORA AuthScreen input without owning OAuth presentation. */
function getOAuthProviderPropsSource(): string {
  return `
        oauthProviders={generatedOAuthProviderItems.map((provider) => ({
          ...provider,
          disabled:
            controller.oauthLoadingProvider !== null &&
            controller.oauthLoadingProvider !== provider.id,
          loading: controller.oauthLoadingProvider === provider.id,
        }))}`;
}
