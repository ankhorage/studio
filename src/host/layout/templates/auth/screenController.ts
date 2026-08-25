import type { GeneratedOAuthProviderPlan } from '../../auth/resolveAuthLayoutPlan';
import { escapeStringLiteral } from '../../utils/escapeStringLiteral';
import { routeNameToGroupedHref } from '../utils/routes';

function serializeStringArrayLiteral(values: readonly string[]): string {
  return `[${values.map((value) => `'${escapeStringLiteral(value)}'`).join(', ')}]`;
}

interface AuthScreenControllerTemplateArgs {
  signInRoute: string;
  signUpRoute: string;
  postSignInRoute: string;
  signInIdentifiers: string[];
  signUpRequiredFields: string[];
  signUpOptionalFields: string[];
  signUpPolicy: 'autoSignIn' | 'requireVerification';
  oauthProviders?: readonly GeneratedOAuthProviderPlan[];
}

export function getAuthScreenControllerTs(args: AuthScreenControllerTemplateArgs) {
  const oauthEnabled = (args.oauthProviders?.length ?? 0) > 0;
  const oauthImport = oauthEnabled
    ? `import { startOAuthAuthorization } from '@/auth/oauth';\n`
    : '';
  const oauthController = oauthEnabled
    ? getOAuthControllerSource()
    : `
  function handleOAuthProviderPress(): Promise<void> {
    return Promise.resolve();
  }`;
  const sessionGuardImport = args.signUpPolicy === 'autoSignIn' ? '  isAuthSession,\n' : '';
  const successfulSignUp =
    args.signUpPolicy === 'autoSignIn'
      ? `  if (isAuthSession(result.data)) {
    await setStoredAuthSession(result.data);
    router.replace(POST_SIGN_IN_ROUTE);
    return;
  }
`
      : '';

  return `import { type SignInFormValues, type SignUpFormValues } from '@ankhorage/zora';
import { useRouter } from 'expo-router';
import { useMemo, useState } from 'react';

import { authAdapter } from '@/auth/adapter';
import {
  type AuthSubmitValues,
  buildAuthIdentifierInput,
  buildSignUpFields,
  buildSignUpProfile,
  getFormValue,
${sessionGuardImport}  resolveAuthIdentifiers,
  resolveIdentifierFieldDefinition,
  validateAuthSubmitValues,
} from '@/auth/form';
${oauthImport}import { clearStoredAuthSession, setStoredAuthSession } from '@/auth/session';

const SIGN_IN_IDENTIFIERS: string[] = ${serializeStringArrayLiteral(args.signInIdentifiers)};
const SIGN_UP_REQUIRED_FIELDS: string[] = ${serializeStringArrayLiteral(args.signUpRequiredFields)};
const SIGN_UP_OPTIONAL_FIELDS: string[] = ${serializeStringArrayLiteral(args.signUpOptionalFields)};
const SIGN_IN_ROUTE = '${escapeStringLiteral(routeNameToGroupedHref(args.signInRoute, 'auth'))}';
const SIGN_UP_ROUTE = '${escapeStringLiteral(routeNameToGroupedHref(args.signUpRoute, 'auth'))}';
const POST_SIGN_IN_ROUTE = '${escapeStringLiteral(routeNameToGroupedHref(args.postSignInRoute, 'app'))}';

export type AuthMode = 'signIn' | 'signUp';

export interface AuthScreenController {
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

export function useAuthScreenController(initialMode: AuthMode): AuthScreenController {
  const router = useRouter();
  const [mode, setMode] = useState<AuthMode>(initialMode);
  const [loading, setLoading] = useState(false);
  const [oauthLoadingProvider, setOAuthLoadingProvider] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const { authIdentifiers, identifierField, signUpFields } = useAuthFormFields();
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

function useAuthFormFields() {
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
  return { authIdentifiers, identifierField, signUpFields };
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
${successfulSignUp}  await clearStoredAuthSession();
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
