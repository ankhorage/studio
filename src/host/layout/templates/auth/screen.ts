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

export function getAuthScreenTsx(args: AuthScreenTemplateArgs) {
  const safeName = toSafeComponentName(args.screenName);
  return `import { GeneratedAuthScreen } from '@/screens/auth-screen';

export default function ${safeName}Screen() {
  return <GeneratedAuthScreen initialMode="${args.initialMode}" title="${escapeStringLiteral(args.title ?? args.screenName)}" />;
}
`;
}

export function getAuthScreenRuntimeTsx(
  args: Omit<AuthScreenTemplateArgs, 'initialMode' | 'screenName' | 'title'>,
) {
  const oauthEnabled = (args.oauthProviders?.length ?? 0) > 0;
  const oauthImports = oauthEnabled
    ? `import { generatedOAuthProviderItems } from '@/auth/oauth';\n`
    : '';
  const oauthZoraImport = oauthEnabled ? 'OAuthProviderList' : '';
  const oauthView = oauthEnabled ? getOAuthViewSource() : '';
  const formLoading = oauthEnabled
    ? 'controller.loading || controller.oauthLoadingProvider !== null'
    : 'controller.loading';

  return `import type { AppManifest } from '@ankhorage/contracts';
import { ManifestProvider } from '@ankhorage/runtime';
import { ${oauthZoraImport.trim()}${oauthZoraImport ? ', ' : ''}SignInForm, SignUpForm, Text, useZoraTheme } from '@ankhorage/zora';
import ankhConfig from '@root/ankh.config.json';
import { Stack } from 'expo-router';
import { StyleSheet, View } from 'react-native';

${oauthImports}import {
  type AuthMode,
  type AuthScreenController,
  useAuthScreenController,
} from '@/auth/screen-controller';

const fallbackManifest = ankhConfig as unknown as AppManifest;

export function GeneratedAuthScreen({
  initialMode,
  title,
}: {
  initialMode: AuthMode;
  title: string;
}) {
  const controller = useAuthScreenController(initialMode);
  const { theme } = useZoraTheme();
  return (
    <ManifestProvider manifest={fallbackManifest}>
      <View style={[styles.container, { backgroundColor: theme.colors.background }]}>
        <Stack.Screen options={{ title }} />
        <View
          style={[
            styles.card,
            { backgroundColor: theme.colors.surface, borderColor: theme.colors.border },
          ]}
        >
          <AuthScreenContent borderColor={theme.colors.border} controller={controller} />
        </View>
      </View>
    </ManifestProvider>
  );
}

function AuthScreenContent({
  borderColor,
  controller,
}: {
  borderColor: string;
  controller: AuthScreenController;
}) {
  return (
    <>
      <Text variant="lead" weight="semiBold">
        {controller.mode === 'signIn' ? 'Sign in' : 'Create account'}
      </Text>
      <Text emphasis="muted" variant="bodySmall">
        {controller.identifierField.helper}
      </Text>${oauthView}
      <AuthForm controller={controller} />
      {controller.info ? (
        <Text color="success" variant="bodySmall">
          {controller.info}
        </Text>
      ) : null}
    </>
  );
}

function AuthForm({ controller }: { controller: AuthScreenController }) {
  if (controller.mode === 'signIn') {
    return (
      <SignInForm
        error={controller.error}
        identifierLabel={controller.identifierField.label}
        identifiers={controller.authIdentifiers}
        loading={${formLoading}}
        onSignUp={controller.showSignUp}
        onSubmit={controller.handleSignInSubmit}
        signUpLabel="Need an account? Sign up"
        submitLabel="Sign in"
      />
    );
  }
  return (
    <SignUpForm
      error={controller.error}
      fields={controller.signUpFields}
      loading={${formLoading}}
      onSignIn={controller.showSignIn}
      onSubmit={controller.handleSignUpSubmit}
      signInLabel="Already have an account? Sign in"
      submitLabel="Create account"
    />
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    flex: 1,
    justifyContent: 'center',
    padding: 24,
  },
  card: {
    borderRadius: 24,
    borderWidth: 1,
    gap: 16,
    maxWidth: 560,
    padding: 24,
    width: '100%',
  },
  separatorLine: {
    flex: 1,
    height: StyleSheet.hairlineWidth,
  },
  separatorRow: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 12,
  },
});
`;
}

function getOAuthViewSource(): string {
  return `
      <OAuthProviderList
        disabled={controller.loading}
        onProviderPress={controller.handleOAuthProviderPress}
        providers={generatedOAuthProviderItems.map((provider) => ({
          ...provider,
          disabled:
            controller.oauthLoadingProvider !== null &&
            controller.oauthLoadingProvider !== provider.id,
          loading: controller.oauthLoadingProvider === provider.id,
        }))}
      />
      <View style={styles.separatorRow}>
        <View style={[styles.separatorLine, { backgroundColor: borderColor }]} />
        <Text emphasis="muted" variant="bodySmall">
          or continue with password
        </Text>
        <View style={[styles.separatorLine, { backgroundColor: borderColor }]} />
      </View>`;
}
