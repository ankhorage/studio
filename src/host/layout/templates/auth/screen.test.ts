import { expect, test } from 'bun:test';

import { getAuthFormTs } from './form';
import { getAuthScreenTsx, getAuthScreenRuntimeTsx } from './screen';
import { getAuthScreenControllerTs } from './screenController';

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
  const controller = getAuthScreenControllerTs({
    signInRoute: 'sign-in',
    signUpRoute: 'sign-up',
    postSignInRoute: 'home',
    signInIdentifiers: ['email', 'phone', 'username'],
    signUpRequiredFields: ['email', 'password'],
    signUpOptionalFields: [],
    signUpPolicy: 'autoSignIn',
  });
  const verificationController = getAuthScreenControllerTs({
    signInRoute: 'sign-in',
    signUpRoute: 'sign-up',
    postSignInRoute: 'home',
    signInIdentifiers: ['email'],
    signUpRequiredFields: ['email', 'password'],
    signUpOptionalFields: [],
    signUpPolicy: 'requireVerification',
  });

  expect(route).toContain("import { GeneratedAuthScreen } from '@/screens/auth-screen';");
  expect(route).toContain('<GeneratedAuthScreen initialMode="signIn" title="Auth" />');
  expect(route).not.toContain('useState');
  expect(runtime).toContain("import { AuthScreen } from '@ankhorage/zora';");
  expect(runtime).toContain('<AuthScreen');
  expect(runtime).toContain('authMode={controller.mode}');
  expect(runtime).toContain('onModeChange={controller.showMode}');
  expect(runtime).toContain('onSignInSubmit={controller.handleSignInSubmit}');
  expect(runtime).toContain('onSignUpSubmit={controller.handleSignUpSubmit}');
  expect(runtime).not.toContain('SignInForm');
  expect(runtime).not.toContain('SignUpForm');
  expect(runtime).not.toContain('OAuthProviderList');
  expect(runtime).not.toContain('KeyboardAvoidingView');
  expect(runtime).not.toContain('StyleSheet');
  expect(runtime).not.toContain('ScrollView');
  expect(runtime).not.toContain('useZoraTheme');
  expect(runtime).not.toContain("from '@ankhorage/surface'");
  expect(runtime).toContain("from '@/auth/screen-controller';");
  expect(controller).toContain("from '@/auth/form';");
  expect(controller).toContain('export function useAuthScreenController');
  expect(controller).toContain('showMode: (nextMode: AuthMode) => void;');
  expect(controller).toContain('if (isAuthSession(result.data))');
  expect(controller).not.toContain('AUTO_SIGN_IN_AFTER_SIGN_UP');
  expect(verificationController).not.toContain('isAuthSession');
  expect(verificationController).toContain('await clearStoredAuthSession();');
});
