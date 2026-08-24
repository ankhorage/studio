import { expect, test } from 'bun:test';

import { getAuthFormTs } from './form';
import { getAuthScreenTsx, getAuthScreenRuntimeTsx } from './screen';

test('generated auth validation stays in one canonical package-neutral module', () => {
  const form = getAuthFormTs();

  expect(form).toContain(
    "import { isEmail, isPhone, isUsername } from '@ankhorage/utility/regex';",
  );
  expect(form).not.toContain('function isEmail(');
  expect(form).not.toContain('function isPhone(');
  expect(form).not.toContain('function isUsername(');
});

test('generated Expo Router auth files are thin screen delegates', () => {
  const route = getAuthScreenTsx({
    initialMode: 'signIn',
    screenName: 'Auth',
    title: 'Auth',
    signInRoute: 'sign-in',
    signUpRoute: 'sign-up',
    postSignInRoute: 'home',
    signInIdentifiers: ['email'],
    signUpRequiredFields: ['email', 'password'],
    signUpOptionalFields: [],
    signUpPolicy: 'autoSignIn',
  });
  const runtime = getAuthScreenRuntimeTsx({
    signInRoute: 'sign-in',
    signUpRoute: 'sign-up',
    postSignInRoute: 'home',
    signInIdentifiers: ['email', 'phone', 'username'],
    signUpRequiredFields: ['email', 'password'],
    signUpOptionalFields: [],
    signUpPolicy: 'autoSignIn',
  });

  expect(route).toContain("import { GeneratedAuthScreen } from '@/screens/auth-screen';");
  expect(route).toContain('<GeneratedAuthScreen initialMode="signIn" title="Auth" />');
  expect(route).not.toContain('useState');
  expect(runtime).toContain('SignInForm');
  expect(runtime).toContain("from '@/auth/form';");
});
