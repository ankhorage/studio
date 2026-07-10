import { escapeStringLiteral } from '../../utils/escapeStringLiteral';
import { routeNameToGroupedHref } from '../utils/routes';
import { toSafeComponentName } from '../utils/strings';

const AUTH_SCREEN_CONTAINER_PADDING = 24;
const AUTH_SCREEN_CARD_MAX_WIDTH = 560;

function serializeStringArrayLiteral(values: readonly string[]): string {
  return `[${values.map((value) => `'${escapeStringLiteral(value)}'`).join(', ')}]`;
}

export function getAuthScreenTsx(args: {
  initialMode: 'signIn' | 'signUp';
  screenName: string;
  title?: string;
  signInRoute: string;
  signUpRoute: string;
  signInIdentifiers: string[];
  signUpRequiredFields: string[];
  signUpOptionalFields: string[];
  signUpPolicy: 'autoSignIn' | 'requireVerification';
}) {
  const {
    initialMode,
    screenName,
    title,
    signInRoute,
    signUpRoute,
    signInIdentifiers,
    signUpRequiredFields,
    signUpOptionalFields,
    signUpPolicy,
  } = args;
  const safeName = toSafeComponentName(screenName);
  const signUpSessionMessage =
    signUpPolicy === 'autoSignIn'
      ? `        setStoredAuthSession(result.data);`
      : `        clearStoredAuthSession();
        router.replace(SIGN_IN_ROUTE);`;

  return `import type { AppManifest } from '@ankhorage/contracts';
import type { AuthIdentifier, AuthSession } from '@ankhorage/contracts/auth';
import {
  type AuthIdentifierKind,
  SignInForm,
  type SignInFormValues,
  SignUpForm,
  type SignUpFormField,
  type SignUpFormValues,
  Text,
  useZoraTheme,
} from '@ankhorage/zora';
import ankhConfig from '@root/ankh.config.json';
import { Stack, useRouter } from 'expo-router';
import React, { useMemo, useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { authAdapter } from '@/auth/adapter';
import { clearStoredAuthSession, setStoredAuthSession } from '@/auth/session';
import { ManifestProvider } from '@ankhorage/runtime';

const SIGN_IN_IDENTIFIERS: string[] = ${serializeStringArrayLiteral(signInIdentifiers)};
const SIGN_UP_REQUIRED_FIELDS: string[] = ${serializeStringArrayLiteral(signUpRequiredFields)};
const SIGN_UP_OPTIONAL_FIELDS: string[] = ${serializeStringArrayLiteral(signUpOptionalFields)};
const SIGN_IN_ROUTE = '${escapeStringLiteral(routeNameToGroupedHref(signInRoute, 'auth'))}';
const SIGN_UP_ROUTE = '${escapeStringLiteral(routeNameToGroupedHref(signUpRoute, 'auth'))}';
const fallbackManifest = ankhConfig as unknown as AppManifest;
const authScreenOptions = {
  title: '${escapeStringLiteral(title ?? screenName)}',
};

type AuthMode = 'signIn' | 'signUp';

interface AuthSubmitValues {
  mode: AuthMode;
  identifier: string;
  password: string;
  firstName: string;
  lastName: string;
  displayName: string;
}

function getErrorMessage(caught: unknown): string {
  if (caught instanceof Error) {
    return caught.message;
  }

  if (typeof caught === 'string') {
    return caught;
  }

  return 'Unknown auth error';
}

export default function ${safeName}Screen() {
  const router = useRouter();
  const { theme } = useZoraTheme();

  const [mode, setMode] = useState<AuthMode>('${initialMode}');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);

  const identifierField = useMemo(() => resolveIdentifierFieldDefinition(SIGN_IN_IDENTIFIERS), []);
  const authIdentifiers = useMemo(() => resolveAuthIdentifiers(SIGN_IN_IDENTIFIERS), []);
  const signUpFields = useMemo(
    () =>
      buildSignUpFields({
        identifierField,
        configuredFields: unique([...SIGN_UP_REQUIRED_FIELDS, ...SIGN_UP_OPTIONAL_FIELDS]),
        requiredFields: SIGN_UP_REQUIRED_FIELDS,
      }),
    [identifierField],
  );

  function showSignIn() {
    setMode('signIn');
    setError(null);
    setInfo(null);
    router.replace(SIGN_IN_ROUTE);
  }

  function showSignUp() {
    setMode('signUp');
    setError(null);
    setInfo(null);
    router.replace(SIGN_UP_ROUTE);
  }

  async function handleSignInSubmit(values: SignInFormValues) {
    await submitAuthForm({
      mode: 'signIn',
      identifier: values.identifier,
      password: values.secret,
      firstName: '',
      lastName: '',
      displayName: '',
    });
  }

  async function handleSignUpSubmit(values: SignUpFormValues) {
    await submitAuthForm({
      mode: 'signUp',
      identifier: getFormValue(values, 'identifier'),
      password: getFormValue(values, 'password'),
      firstName: getFormValue(values, 'firstName'),
      lastName: getFormValue(values, 'lastName'),
      displayName: getFormValue(values, 'displayName'),
    });
  }

  async function submitAuthForm(values: AuthSubmitValues) {
    const { mode, identifier, password, firstName, lastName, displayName } = values;

    setError(null);
    setInfo(null);

    const trimmedIdentifier = identifier.trim();
    const normalizedPassword = password;
    if (!trimmedIdentifier || normalizedPassword.length === 0) {
      setError('Enter both credentials before continuing.');
      return;
    }

    const identifierValidationError = validateIdentifier(trimmedIdentifier, SIGN_IN_IDENTIFIERS);
    if (identifierValidationError) {
      setError(identifierValidationError);
      return;
    }

    if (normalizedPassword.length < 6) {
      setError('Password must be at least 6 characters.');
      return;
    }

    if (mode === 'signUp') {
      const signUpValidationError = validateSignUpInput({
        identifier: trimmedIdentifier,
        password: normalizedPassword,
        requiredFields: SIGN_UP_REQUIRED_FIELDS,
        firstName,
        lastName,
        displayName,
      });
      if (signUpValidationError) {
        setError(signUpValidationError);
        return;
      }
    }

    const authIdentifier = buildAuthIdentifierInput(trimmedIdentifier, SIGN_IN_IDENTIFIERS);
    if (!authIdentifier) {
      setError('Unable to resolve the configured sign-in identifier.');
      return;
    }

    setLoading(true);
    try {
      if (mode === 'signIn') {
        const result = await authAdapter.signIn({
          identifier: authIdentifier,
          password: normalizedPassword,
        });

        if (!result.ok) {
          setError(result.error.message);
          return;
        }

        if (!result.data) {
          setError('Sign in succeeded without a session.');
          return;
        }

        setStoredAuthSession(result.data);
        return;
      }

      const result = await authAdapter.signUp({
        identifier: authIdentifier,
        password: normalizedPassword,
        profile: buildSignUpProfile({
          firstName,
          lastName,
          displayName,
        }),
      });

      if (!result.ok) {
        setError(result.error.message);
        return;
      }

      if (isAuthSession(result.data)) {
${signUpSessionMessage}
        return;
      }

      router.replace(SIGN_IN_ROUTE);
    } catch (caught) {
      setError(getErrorMessage(caught));
    } finally {
      setLoading(false);
    }
  }

  return (
    <ManifestProvider manifest={fallbackManifest}>
      <View
        style={{
          flex: 1,
          backgroundColor: theme.colors.background,
          justifyContent: 'center',
          alignItems: 'center',
          padding: ${AUTH_SCREEN_CONTAINER_PADDING},
        }}
      >
        <Stack.Screen options={authScreenOptions} />
        <View
          style={[
            styles.card,
            {
              backgroundColor: theme.colors.surface,
              borderColor: theme.colors.border,
            },
          ]}
        >
          <Text variant="lead" weight="semiBold">
            {mode === 'signIn' ? 'Sign in' : 'Create account'}
          </Text>
          <Text emphasis="muted" variant="bodySmall">
            {identifierField.helper}
          </Text>

          {mode === 'signIn' ? (
            <SignInForm
              error={error}
              identifierLabel={identifierField.label}
              identifiers={authIdentifiers}
              loading={loading}
              onSignUp={showSignUp}
              onSubmit={handleSignInSubmit}
              signUpLabel="Need an account? Sign up"
              submitLabel="Sign in"
            />
          ) : (
            <SignUpForm
              error={error}
              fields={signUpFields}
              loading={loading}
              onSignIn={showSignIn}
              onSubmit={handleSignUpSubmit}
              signInLabel="Already have an account? Sign in"
              submitLabel="Create account"
            />
          )}

          {info ? (
            <Text color="success" variant="bodySmall">
              {info}
            </Text>
          ) : null}
        </View>
      </View>
    </ManifestProvider>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: 24,
    borderWidth: 1,
    gap: 16,
    maxWidth: ${AUTH_SCREEN_CARD_MAX_WIDTH},
    padding: 24,
    width: '100%',
  },
});

function buildAuthIdentifierInput(
  identifier: string,
  identifiers: string[],
): AuthIdentifier | null {
  const normalizedIdentifier = identifier.trim();
  const resolvedIdentifiers = resolveAuthIdentifiers(identifiers);

  if (resolvedIdentifiers.includes('email') && isEmail(normalizedIdentifier)) {
    return { kind: 'email' as const, value: normalizedIdentifier };
  }

  if (resolvedIdentifiers.includes('phone') && isPhone(normalizedIdentifier)) {
    return { kind: 'phone' as const, value: normalizedIdentifier };
  }

  if (resolvedIdentifiers.includes('username') && isUsername(normalizedIdentifier)) {
    return { kind: 'username' as const, value: normalizedIdentifier };
  }

  const [fallbackKind] = resolvedIdentifiers;
  return fallbackKind ? { kind: fallbackKind, value: normalizedIdentifier } : null;
}

function buildSignUpProfile(args: { firstName: string; lastName: string; displayName: string }) {
  const { firstName, lastName, displayName } = args;
  const profile: Record<string, string> = {};

  if (firstName.trim()) profile.firstName = firstName.trim();
  if (lastName.trim()) profile.lastName = lastName.trim();
  if (displayName.trim()) profile.displayName = displayName.trim();

  return Object.keys(profile).length > 0 ? profile : undefined;
}

function isAuthSession(value: unknown): value is AuthSession {
  if (!isRecord(value)) {
    return false;
  }

  const { accessToken, user } = value;
  if (typeof accessToken !== 'string' || accessToken.length === 0) {
    return false;
  }

  if (!isRecord(user)) {
    return false;
  }

  const { id: userId } = user;
  return typeof userId === 'string' && userId.length > 0;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function getFormValue(values: SignUpFormValues, name: string): string {
  return values[name] ?? '';
}

function buildSignUpFields(args: {
  identifierField: ReturnType<typeof resolveIdentifierFieldDefinition>;
  configuredFields: string[];
  requiredFields: string[];
}): SignUpFormField[] {
  const { identifierField, configuredFields, requiredFields } = args;
  const fields: SignUpFormField[] = [
    {
      name: 'identifier',
      label: identifierField.label,
      helperText: identifierField.helper,
      placeholder: identifierField.placeholder,
      type: identifierField.type,
      autoCapitalize: 'none',
      keyboardType: identifierField.keyboardType,
      required:
        hasConfiguredSignUpField(requiredFields, 'email') ||
        hasConfiguredSignUpField(requiredFields, 'phone') ||
        hasConfiguredSignUpField(requiredFields, 'username'),
    },
    {
      name: 'password',
      label: 'Password',
      type: 'password',
      required: hasConfiguredSignUpField(requiredFields, 'password'),
    },
  ];

  if (hasConfiguredSignUpField(configuredFields, 'firstname')) {
    fields.push({
      name: 'firstName',
      label: 'First name',
      type: 'text',
      required: hasConfiguredSignUpField(requiredFields, 'firstname'),
    });
  }

  if (hasConfiguredSignUpField(configuredFields, 'lastname')) {
    fields.push({
      name: 'lastName',
      label: 'Last name',
      type: 'text',
      required: hasConfiguredSignUpField(requiredFields, 'lastname'),
    });
  }

  if (hasConfiguredSignUpField(configuredFields, 'displayname')) {
    fields.push({
      name: 'displayName',
      label: 'Display name',
      type: 'text',
      required: hasConfiguredSignUpField(requiredFields, 'displayname'),
    });
  }

  return fields;
}

function hasConfiguredSignUpField(fields: string[], field: string): boolean {
  return fields.some((value) => value.trim().toLowerCase() === field);
}

function resolveAuthIdentifiers(identifiers: string[]): AuthIdentifierKind[] {
  const resolved: AuthIdentifierKind[] = [];

  for (const identifier of identifiers) {
    const normalized = identifier.trim().toLowerCase();
    if (isAuthIdentifierKind(normalized) && !resolved.includes(normalized)) {
      resolved.push(normalized);
    }
  }

  return resolved.length > 0 ? resolved : ['email'];
}

function isAuthIdentifierKind(value: string): value is AuthIdentifierKind {
  return value === 'email' || value === 'phone' || value === 'username';
}

function resolveIdentifierFieldDefinition(identifiers: string[]) {
  const set = new Set(identifiers.map((identifier) => identifier.trim().toLowerCase()));
  const supportsEmail = set.has('email');
  const supportsPhone = set.has('phone');
  const supportsUsername = set.has('username');

  if (supportsEmail && !supportsPhone && !supportsUsername) {
    return {
      label: 'Email',
      placeholder: 'hello@example.com',
      helper: 'Use your email to continue.',
      type: 'email' as const,
      keyboardType: 'email-address' as const,
    };
  }

  if (supportsPhone && !supportsEmail && !supportsUsername) {
    return {
      label: 'Phone',
      placeholder: '+1 555 123 4567',
      helper: 'Use your phone to continue.',
      type: 'tel' as const,
      keyboardType: 'phone-pad' as const,
    };
  }

  if (supportsUsername && !supportsEmail && !supportsPhone) {
    return {
      label: 'Username',
      placeholder: 'your-username',
      helper: 'Use your username to continue.',
      type: 'text' as const,
      keyboardType: 'default' as const,
    };
  }

  return {
    label: supportsUsername ? 'Identifier' : 'Email or phone',
    placeholder: 'Email or phone',
    helper: 'Use your configured identifier to continue.',
    type: 'text' as const,
    keyboardType: 'default' as const,
  };
}

function validateIdentifier(identifier: string, identifiers: string[]): string | null {
  const normalizedIdentifier = identifier.trim();
  const set = new Set(identifiers.map((entry) => entry.trim().toLowerCase()));
  const supportsEmail = set.has('email');
  const supportsPhone = set.has('phone');
  const supportsUsername = set.has('username');

  const matchesEmail = isEmail(normalizedIdentifier);
  const matchesPhone = isPhone(normalizedIdentifier);
  const matchesUsername = isUsername(normalizedIdentifier);

  const allowed: { label: string; matches: boolean }[] = [];
  if (supportsEmail) allowed.push({ label: 'email address', matches: matchesEmail });
  if (supportsPhone) allowed.push({ label: 'phone number', matches: matchesPhone });
  if (supportsUsername) allowed.push({ label: 'username', matches: matchesUsername });

  if (allowed.length === 0 || allowed.some((entry) => entry.matches)) {
    return null;
  }

  if (allowed.length === 1 && allowed[0]?.label === 'username') {
    return 'Username must be at least 3 characters and use letters, numbers, dot, underscore, or dash.';
  }

  if (allowed.length === 1) {
    return 'Use a valid ' + (allowed[0]?.label ?? 'identifier') + '.';
  }

  if (allowed.length === 2) {
    return (
      'Use a valid ' +
      (allowed[0]?.label ?? 'identifier') +
      ' or ' +
      (allowed[1]?.label ?? 'identifier') +
      '.'
    );
  }

  return (
    'Use a valid ' +
    (allowed[0]?.label ?? 'identifier') +
    ', ' +
    (allowed[1]?.label ?? 'identifier') +
    ', or ' +
    (allowed[2]?.label ?? 'identifier') +
    '.'
  );
}

function validateSignUpInput(args: {
  identifier: string;
  password: string;
  requiredFields: string[];
  firstName: string;
  lastName: string;
  displayName: string;
}): string | null {
  const { identifier, password, requiredFields, firstName, lastName, displayName } = args;
  const missing: string[] = [];

  for (const field of requiredFields) {
    const normalized = field.trim().toLowerCase();
    switch (normalized) {
      case 'email':
      case 'username':
      case 'phone':
        if (!identifier.trim()) missing.push(fieldLabel(normalized));
        break;
      case 'password':
        if (password.length === 0) missing.push('password');
        break;
      case 'firstname':
        if (!firstName.trim()) missing.push('first name');
        break;
      case 'lastname':
        if (!lastName.trim()) missing.push('last name');
        break;
      case 'displayname':
        if (!displayName.trim()) missing.push('display name');
        break;
      default:
        break;
    }
  }

  if (missing.length > 0) {
    return 'Complete required fields: ' + missing.join(', ') + '.';
  }

  return null;
}

function fieldLabel(normalized: string): string {
  switch (normalized) {
    case 'email':
      return 'email';
    case 'phone':
      return 'phone';
    case 'username':
      return 'username';
    default:
      return normalized;
  }
}

function isEmail(value: string): boolean {
  const normalized = value.trim();
  if (normalized.length === 0 || normalized.length > 254) return false;

  const atIndex = normalized.indexOf('@');
  if (atIndex <= 0 || atIndex !== normalized.lastIndexOf('@')) return false;

  const localPart = normalized.slice(0, atIndex);
  const domainPart = normalized.slice(atIndex + 1);
  if (localPart.length > 64 || domainPart.length === 0) return false;

  if (!/^[A-Za-z0-9.!#$%&'*+/=?^_\`{|}~-]+$/.test(localPart)) return false;
  if (!/^[A-Za-z0-9.-]+$/.test(domainPart)) return false;
  if (domainPart.startsWith('.') || domainPart.endsWith('.') || domainPart.includes('..')) {
    return false;
  }

  const labels = domainPart.split('.');
  const [topLevelDomain] = labels.slice(-1);
  if (labels.length < 2) return false;
  if (
    labels.some(
      (label) =>
        label.length === 0 ||
        label.length > 63 ||
        label.startsWith('-') ||
        label.endsWith('-') ||
        !/^[A-Za-z0-9-]+$/.test(label),
    )
  ) {
    return false;
  }

  return (topLevelDomain ?? '').length >= 2;
}

function isPhone(value: string): boolean {
  const normalized = value.trim();
  if (normalized.length === 0) return false;
  if (!/^[+()\\d\\s.-]+$/.test(normalized)) return false;

  const digitCount = (normalized.match(/\\d/g) ?? []).length;
  if (digitCount < 7 || digitCount > 15) return false;

  const plusCount = (normalized.match(/\\+/g) ?? []).length;
  if (plusCount > 1) return false;
  if (plusCount === 1 && !normalized.startsWith('+')) return false;

  const openParenCount = (normalized.match(/\\(/g) ?? []).length;
  const closeParenCount = (normalized.match(/\\)/g) ?? []).length;
  if (openParenCount !== closeParenCount) return false;

  return true;
}

function isUsername(value: string): boolean {
  return /^[a-zA-Z0-9._-]{3,}$/.test(value);
}

function unique(values: string[]): string[] {
  return [...new Set(values)];
}
`;
}
