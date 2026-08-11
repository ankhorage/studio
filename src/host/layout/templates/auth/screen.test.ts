import { expect, test } from 'bun:test';

import { getAuthScreenTsx } from './screen';

test('generated auth screens use canonical utility validators', () => {
  const source = getAuthScreenTsx({
    initialMode: 'signIn',
    screenName: 'Auth',
    signInRoute: 'sign-in',
    signUpRoute: 'sign-up',
    postSignInRoute: 'home',
    signInIdentifiers: ['email', 'phone', 'username'],
    signUpRequiredFields: ['email', 'password'],
    signUpOptionalFields: [],
    signUpPolicy: 'autoSignIn',
  });

  expect(source).toContain(
    "import { isEmail, isPhone, isUsername } from '@ankhorage/utility/regex';",
  );
  expect(source).not.toContain('function isEmail(');
  expect(source).not.toContain('function isPhone(');
  expect(source).not.toContain('function isUsername(');
});
