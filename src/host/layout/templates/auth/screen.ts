import type { GeneratedOAuthProviderPlan } from '../../auth/resolveAuthLayoutPlan';
import { escapeStringLiteral } from '../../utils/escapeStringLiteral';
import { routeNameToGroupedHref } from '../utils/routes';
import { toSafeComponentName } from '../utils/strings';

function serializeStringArrayLiteral(values: readonly string[]): string {
  return `[${values.map((value) => `'${escapeStringLiteral(value)}'`).join(', ')}]`;
}

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
    ? `import { generatedOAuthProviderItems, startOAuthAuthorization } from '@/auth/oauth';\n`
    : '';
  const oauthZoraImport = oauthEnabled ? '  OAuthProviderList,\n' : '';
  const oauthController = oauthEnabled
    ? getOAuthControllerSource()
    : `
  function handleOAuthProviderPress(): Promise<void> {
    return Promise.resolve();
  }`;
  const oauthView = oauthEnabled ? getOAuthViewSource() : '';
  const formLoading = oauthEnabled
    ? 'controller.loading || controller.oauthLoadingProvider !== null'
    : 'controller.loading';
  const postSignInTarget = routeNameToGroupedHref(args.postSignInRoute, 'app');

  return `import type { AppManifest } from '@ankhorage/contracts';
import { ManifestProvider } from '@ankhorage/runtime';
import {
${oauthZoraImport}  SignInForm,
  type SignInFormValues,
  SignUpForm,
  type SignUpFormValues,
  Text,
  useZoraTheme,
} from '@ankhorage/zora';
import ankhConfig from '@root/ankh.config.json';
import { Stack, useRouter } from 'expo-router';
import { useMemo, useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { authAdapter } from '@/auth/adapter';
import {
  type AuthSubmitValues,
  buildAuthIdentifierInput,
  buildSignUpFields,
  buildSignUpProfile,
  getFormValue,
  isAuthSession,
  resolveAuthIdentifiers,
  resolveIdentifierFieldDefinition,
  validateAuthSubmitValues,
} from '@/auth/form';
${oauthImports}import { clearStoredAuthSession, setStoredAuthSession } from '@/auth/session';

const SIGN_IN_IDENTIFIERS: string[] = ${serializeStringArrayLiteral(args.signInIdentifiers)};
const SIGN_UP_REQUIRED_FIELDS: string[] = ${serializeStringArrayLiteral(args.signUpRequiredFields)};
const SIGN_UP_OPTIONAL_FIELDS: string[] = ${serializeStringArrayLiteral(args.signUpOptionalFields)};
const SIGN_IN_ROUTE = '${escapeStringLiteral(routeNameToGroupedHref(args.signInRoute, 'auth'))}';
const SIGN_UP_ROUTE = '${escapeStringLiteral(routeNameToGroupedHref(args.signUpRoute, 'auth'))}';
const POST_SIGN_IN_ROUTE = '${escapeStringLiteral(postSignInTarget)}';
const AUTO_SIGN_IN_AFTER_SIGN_UP = ${String(args.signUpPolicy === 'autoSignIn')};
const fallbackManifest = ankhConfig as unknown as AppManifest;

type AuthMode = 'signIn' | 'signUp';

interface AuthScreenController {
  authIdentifiers: ReturnType<typeof resolveAuthIdentifiers>;
  error: string | null;
  handleOAuthProviderPress: (providerId: string) => Promise<void>;
  handleSignInSubmit: (values: SignInFormValues) => Promise<void>;
  handleSignUpSubmit: (values: SignUpFormValues) => Promise<void>;
  identifierField: ReturnType<typeof resolveIdentifierFieldDefinition>;
  info: string | null;
  loading: boolean;
  mode: AuthMode;
  oauthLoadingProvider: string | null;
  showSignIn: () => void;
  showSignUp: () => void;
  signUpFields: ReturnType<typeof buildSignUpFields>;
}

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

function useAuthScreenController(initialMode: AuthMode): AuthScreenController {
  const router = useRouter();
  const [mode, setMode] = useState<AuthMode>(initialMode);
  const [loading, setLoading] = useState(false);
  const [oauthLoadingProvider, setOAuthLoadingProvider] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const identifierField = useMemo(() => resolveIdentifierFieldDefinition(SIGN_IN_IDENTIFIERS), []);
  const authIdentifiers = useMemo(() => resolveAuthIdentifiers(SIGN_IN_IDENTIFIERS), []);
  const signUpFields = useMemo(
    () =>
      buildSignUpFields({
        identifierField,
        configuredFields: [...new Set([...SIGN_UP_REQUIRED_FIELDS, ...SIGN_UP_OPTIONAL_FIELDS])],
        requiredFields: SIGN_UP_REQUIRED_FIELDS,
      }),
    [identifierField],
  );
  const showMode = (nextMode: AuthMode) => {
    setMode(nextMode);
    setError(null);
    setInfo(null);
    router.replace(nextMode === 'signIn' ? SIGN_IN_ROUTE : SIGN_UP_ROUTE);
  };
  const submit = (values: AuthSubmitValues) =>
    submitAuthFormAsync({ router, setError, setInfo, setLoading, values });
  const handleSignInSubmit = (values: SignInFormValues) => submit(createSignInSubmitValues(values));
  const handleSignUpSubmit = (values: SignUpFormValues) => submit(createSignUpSubmitValues(values));${oauthController}
  return {
    authIdentifiers,
    error,
    handleOAuthProviderPress,
    handleSignInSubmit,
    handleSignUpSubmit,
    identifierField,
    info,
    loading,
    mode,
    oauthLoadingProvider,
    showSignIn: () => showMode('signIn'),
    showSignUp: () => showMode('signUp'),
    signUpFields,
  };
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

async function submitAuthFormAsync(args: {
  router: ReturnType<typeof useRouter>;
  setError: (message: string | null) => void;
  setInfo: (message: string | null) => void;
  setLoading: (loading: boolean) => void;
  values: AuthSubmitValues;
}): Promise<void> {
  const { router, setError, setInfo, setLoading, values } = args;
  setError(null);
  setInfo(null);
  const validationError = validateAuthSubmitValues(
    values,
    SIGN_IN_IDENTIFIERS,
    SIGN_UP_REQUIRED_FIELDS,
  );
  if (validationError) {
    setError(validationError);
    return;
  }
  const identifier = buildAuthIdentifierInput(values.identifier, SIGN_IN_IDENTIFIERS);
  if (!identifier) {
    setError('Unable to resolve the configured sign-in identifier.');
    return;
  }
  setLoading(true);
  try {
    if (values.mode === 'signIn') await signInAsync(identifier, values.password, router, setError);
    else await signUpAsync(identifier, values, router, setError);
  } catch (caught) {
    setError(getErrorMessage(caught));
  } finally {
    setLoading(false);
  }
}

async function signInAsync(
  identifier: NonNullable<ReturnType<typeof buildAuthIdentifierInput>>,
  password: string,
  router: ReturnType<typeof useRouter>,
  setError: (message: string) => void,
): Promise<void> {
  const result = await authAdapter.signIn({ identifier, password });
  if (!result.ok) return setError(result.error.message);
  if (!result.data) return setError('Sign in succeeded without a session.');
  await setStoredAuthSession(result.data);
  router.replace(POST_SIGN_IN_ROUTE);
}

async function signUpAsync(
  identifier: NonNullable<ReturnType<typeof buildAuthIdentifierInput>>,
  values: AuthSubmitValues,
  router: ReturnType<typeof useRouter>,
  setError: (message: string) => void,
): Promise<void> {
  const result = await authAdapter.signUp({
    identifier,
    password: values.password,
    profile: buildSignUpProfile(values),
  });
  if (!result.ok) return setError(result.error.message);
  if (isAuthSession(result.data) && AUTO_SIGN_IN_AFTER_SIGN_UP) {
    await setStoredAuthSession(result.data);
    router.replace(POST_SIGN_IN_ROUTE);
    return;
  }
  await clearStoredAuthSession();
  router.replace(SIGN_IN_ROUTE);
}

function createSignInSubmitValues(values: SignInFormValues): AuthSubmitValues {
  return {
    mode: 'signIn',
    identifier: values.identifier,
    password: values.secret,
    firstName: '',
    lastName: '',
    displayName: '',
  };
}

function createSignUpSubmitValues(values: SignUpFormValues): AuthSubmitValues {
  return {
    mode: 'signUp',
    identifier: getFormValue(values, 'identifier'),
    password: getFormValue(values, 'password'),
    firstName: getFormValue(values, 'firstName'),
    lastName: getFormValue(values, 'lastName'),
    displayName: getFormValue(values, 'displayName'),
  };
}

function getErrorMessage(caught: unknown): string {
  if (caught instanceof Error) return caught.message;
  if (typeof caught === 'string') return caught;
  return 'Unknown auth error';
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

function getOAuthControllerSource(): string {
  return `
  async function handleOAuthProviderPress(providerId: string) {
    if (loading || oauthLoadingProvider !== null) return;
    setError(null);
    setInfo(null);
    setOAuthLoadingProvider(providerId);
    try {
      const outcome = await startOAuthAuthorization(providerId);
      if (outcome.status === 'authenticated') router.replace(POST_SIGN_IN_ROUTE);
      else if (outcome.status === 'cancelled') setInfo(outcome.message);
      else setError(outcome.message);
    } catch (caught) {
      setError(getErrorMessage(caught));
    } finally {
      setOAuthLoadingProvider(null);
    }
  }`;
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
