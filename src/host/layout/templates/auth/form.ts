/*** Generate the auth form model used by generated sign-in and sign-up screens. */
export function getAuthFormTs() {
  return `import type { AuthIdentifier, AuthSession } from '@ankhorage/contracts/auth';
import { isEmail, isPhone, isUsername } from '@ankhorage/utility/regex';
import type { AuthIdentifierKind, SignUpFormField, SignUpFormValues } from '@ankhorage/zora';

export interface AuthSubmitValues {
  mode: 'signIn' | 'signUp';
  identifier: string;
  password: string;
  firstName: string;
  lastName: string;
  displayName: string;
}

export interface IdentifierFieldDefinition {
  helper: string;
  keyboardType: 'default' | 'email-address' | 'phone-pad';
  label: string;
  placeholder: string;
  type: 'email' | 'tel' | 'text';
}

const AUTH_IDENTIFIER_VALIDATORS = [
  { kind: 'email', label: 'email address', matches: isEmail },
  { kind: 'phone', label: 'phone number', matches: isPhone },
  { kind: 'username', label: 'username', matches: isUsername },
] as const;

const OPTIONAL_SIGN_UP_FIELDS = [
  { key: 'firstname', name: 'firstName', label: 'First name' },
  { key: 'lastname', name: 'lastName', label: 'Last name' },
  { key: 'displayname', name: 'displayName', label: 'Display name' },
] as const;

export function buildAuthIdentifierInput(
  identifier: string,
  identifiers: readonly string[],
): AuthIdentifier | null {
  const normalizedIdentifier = identifier.trim();
  const resolvedIdentifiers = resolveAuthIdentifiers(identifiers);
  const match = AUTH_IDENTIFIER_VALIDATORS.find(
    (candidate) =>
      resolvedIdentifiers.includes(candidate.kind) && candidate.matches(normalizedIdentifier),
  );
  if (match) return { kind: match.kind, value: normalizedIdentifier };
  const [fallbackKind] = resolvedIdentifiers;
  return fallbackKind ? { kind: fallbackKind, value: normalizedIdentifier } : null;
}

export function buildSignUpFields(args: {
  identifierField: IdentifierFieldDefinition;
  configuredFields: readonly string[];
  requiredFields: readonly string[];
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
      required: ['email', 'phone', 'username'].some((field) =>
        hasConfiguredSignUpField(requiredFields, field),
      ),
    },
    {
      name: 'password',
      label: 'Password',
      type: 'password',
      required: hasConfiguredSignUpField(requiredFields, 'password'),
    },
  ];
  for (const definition of OPTIONAL_SIGN_UP_FIELDS) {
    if (!hasConfiguredSignUpField(configuredFields, definition.key)) continue;
    fields.push({
      name: definition.name,
      label: definition.label,
      type: 'text',
      required: hasConfiguredSignUpField(requiredFields, definition.key),
    });
  }
  return fields;
}

export function buildSignUpProfile(args: {
  firstName: string;
  lastName: string;
  displayName: string;
}): Record<string, string> | undefined {
  const candidates: [string, string][] = [
    ['firstName', args.firstName.trim()],
    ['lastName', args.lastName.trim()],
    ['displayName', args.displayName.trim()],
  ];
  const entries = candidates.filter(([, value]) => value.length > 0);
  return entries.length > 0 ? Object.fromEntries(entries) : undefined;
}

export function getFormValue(values: SignUpFormValues, name: string): string {
  const value: unknown = Reflect.get(values, name);
  return typeof value === 'string' ? value : '';
}

export function isAuthSession(value: unknown): value is AuthSession {
  if (!isRecord(value)) return false;
  const { accessToken, user } = value;
  if (typeof accessToken !== 'string' || accessToken.length === 0 || !isRecord(user)) return false;
  return typeof user.id === 'string' && user.id.length > 0;
}

export function resolveAuthIdentifiers(identifiers: readonly string[]): AuthIdentifierKind[] {
  const resolved = identifiers
    .map((identifier) => identifier.trim().toLowerCase())
    .filter(isAuthIdentifierKind);
  const unique = [...new Set(resolved)];
  return unique.length > 0 ? unique : ['email'];
}

export function resolveIdentifierFieldDefinition(
  identifiers: readonly string[],
): IdentifierFieldDefinition {
  const supported = new Set(resolveAuthIdentifiers(identifiers));
  if (supported.size === 1 && supported.has('email')) {
    return createIdentifierField(
      'Use your email to continue.',
      'email-address',
      'Email',
      'hello@example.com',
      'email',
    );
  }
  if (supported.size === 1 && supported.has('phone')) {
    return createIdentifierField(
      'Use your phone to continue.',
      'phone-pad',
      'Phone',
      '+1 555 123 4567',
      'tel',
    );
  }
  if (supported.size === 1 && supported.has('username')) {
    return createIdentifierField(
      'Use your username to continue.',
      'default',
      'Username',
      'your-username',
      'text',
    );
  }
  return createIdentifierField(
    'Use your configured identifier to continue.',
    'default',
    supported.has('username') ? 'Identifier' : 'Email or phone',
    'Email or phone',
    'text',
  );
}

export function validateAuthSubmitValues(
  values: AuthSubmitValues,
  identifiers: readonly string[],
  requiredFields: readonly string[],
): string | null {
  const identifier = values.identifier.trim();
  if (!identifier || values.password.length === 0)
    return 'Enter both credentials before continuing.';
  const identifierError = validateIdentifier(identifier, identifiers);
  if (identifierError) return identifierError;
  if (values.password.length < 6) return 'Password must be at least 6 characters.';
  if (values.mode !== 'signUp') return null;
  const missing = requiredFields.flatMap((field) =>
    isRequiredFieldMissing(field, values) ? [fieldLabel(field)] : [],
  );
  return missing.length > 0 ? \`Complete required fields: \${missing.join(', ')}.\` : null;
}

function createIdentifierField(
  helper: string,
  keyboardType: IdentifierFieldDefinition['keyboardType'],
  label: string,
  placeholder: string,
  type: IdentifierFieldDefinition['type'],
): IdentifierFieldDefinition {
  return { helper, keyboardType, label, placeholder, type };
}

function fieldLabel(field: string): string {
  const normalized = field.trim().toLowerCase();
  const definition = OPTIONAL_SIGN_UP_FIELDS.find((candidate) => candidate.key === normalized);
  return definition?.label.toLowerCase() ?? normalized;
}

function formatList(values: readonly string[]): string {
  if (values.length < 2) return values[0] ?? 'identifier';
  if (values.length === 2) return \`\${values[0]} or \${values[1]}\`;
  return \`\${values.slice(0, -1).join(', ')}, or \${values.at(-1)}\`;
}

function hasConfiguredSignUpField(fields: readonly string[], field: string): boolean {
  return fields.some((value) => value.trim().toLowerCase() === field);
}

function isAuthIdentifierKind(value: string): value is AuthIdentifierKind {
  return value === 'email' || value === 'phone' || value === 'username';
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isRequiredFieldMissing(field: string, values: AuthSubmitValues): boolean {
  const normalized = field.trim().toLowerCase();
  if (normalized === 'email' || normalized === 'username' || normalized === 'phone') {
    return values.identifier.trim().length === 0;
  }
  if (normalized === 'password') return values.password.length === 0;
  const optional = OPTIONAL_SIGN_UP_FIELDS.find((candidate) => candidate.key === normalized);
  if (!optional) return false;
  const value: unknown = Reflect.get(values, optional.name);
  return typeof value !== 'string' || value.trim().length === 0;
}

function validateIdentifier(identifier: string, identifiers: readonly string[]): string | null {
  const supported = new Set(resolveAuthIdentifiers(identifiers));
  const allowed = AUTH_IDENTIFIER_VALIDATORS.filter((validator) => supported.has(validator.kind));
  if (allowed.some((validator) => validator.matches(identifier))) return null;
  const labels = allowed.map((validator) => validator.label);
  if (labels.length === 1 && labels[0] === 'username') {
    return 'Username must be at least 3 characters and use letters, numbers, dot, underscore, or dash.';
  }
  return \`Use a valid \${formatList(labels)}.\`;
}
`;
}
