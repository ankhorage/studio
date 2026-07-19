import { describe, expect, test } from 'bun:test';

import type { StudioAuthSettings } from '../authSettings';
import type { StudioManifest } from '../index';
import {
  updateStudioManifestDraftAuthSettings,
  updateStudioManifestDraftNode,
  updateStudioManifestDraftTheme,
} from './studioManifestDraftModel';

function createManifest(): StudioManifest {
  return {
    metadata: { name: 'Demo', slug: 'demo', version: '1.0.0', themeId: 'theme-1' },
    settings: { localization: { defaultLocale: 'en', locales: ['en'] } },
    infra: {
      plugins: [],
      modulesConfig: { preserved: true },
    },
    navigator: {
      type: 'stack',
      initialRouteName: 'home',
      routes: [
        { name: 'home', screenId: 'screen-home' },
        { name: 'details', screenId: 'screen-details' },
      ],
    },
    screens: {
      'screen-home': {
        id: 'screen-home',
        name: 'Home',
        root: { id: 'home-root', type: 'Screen', children: [] },
      },
      'screen-details': {
        id: 'screen-details',
        name: 'Details',
        root: {
          id: 'details-root',
          type: 'Screen',
          children: [{ id: 'details-title', type: 'Text', props: { children: 'Before' } }],
        },
      },
    },
    data: { apis: {} },
    dataBindings: { preserved: { componentId: 'details-title', props: {} } },
    dataSources: {
      source: { id: 'source', kind: 'rest', baseUrl: 'https://api.example.test', endpoints: {} },
    },
    themes: [
      {
        id: 'theme-1',
        name: 'Theme',
        light: { primaryColor: '#111111', harmony: 'monochromatic' },
        dark: { primaryColor: '#222222', harmony: 'analogous' },
      },
    ],
    activeThemeId: 'theme-1',
    activeThemeMode: 'dark',
  };
}

const authSettings = {
  scope: 'global',
  provider: 'supabase',
  flow: {
    signInRoute: 'sign-in',
    signUpRoute: 'sign-up',
    signOutRoute: 'sign-out',
    forgotPasswordRoute: 'forgot-password',
    postSignInRoute: '/',
    unauthorizedRoute: 'sign-in',
  },
  signIn: { identifiers: ['email'] },
  oauth: {
    enabled: true,
    callbackRoute: '/auth/callback',
    providers: [
      {
        id: 'google',
        enabled: true,
        credentialsRef: 'auth/oauth/google',
      },
    ],
  },
} satisfies StudioAuthSettings;

describe('studioManifestDraftModel', () => {
  test('sequential auth, theme, and node mutations compose on the latest manifest', () => {
    const withAuth = updateStudioManifestDraftAuthSettings(createManifest(), authSettings);
    const withTheme = updateStudioManifestDraftTheme(withAuth, 'theme-1', {
      dark: { primaryColor: '#333333' },
    });
    const withNode = updateStudioManifestDraftNode(withTheme, 'details-title', {
      children: 'After',
    });

    expect(withNode.infra.auth?.oauth?.providers[0]?.credentialsRef).toBe('auth/oauth/google');
    expect(withNode.themes[0]?.dark.primaryColor).toBe('#333333');
    expect(withNode.screens['screen-details']?.root.children?.[0]?.props?.children).toBe('After');
  });

  test('node updates resolve the actual owning screen and preserve unrelated manifest sections', () => {
    const updated = updateStudioManifestDraftNode(createManifest(), 'details-title', {
      children: 'Updated on owning screen',
    });

    expect(updated.screens['screen-home']?.root.children).toEqual([]);
    expect(updated.screens['screen-details']?.root.children?.[0]?.props?.children).toBe(
      'Updated on owning screen',
    );
    expect(updated.data).toEqual({ apis: {} });
    expect(updated.dataBindings).toEqual({
      preserved: { componentId: 'details-title', props: {} },
    });
    expect(updated.dataSources).toEqual({
      source: { id: 'source', kind: 'rest', baseUrl: 'https://api.example.test', endpoints: {} },
    });
  });
});
