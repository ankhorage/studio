import type { AppDeployTargets } from '@ankhorage/contracts/deploy';
import { describe, expect, it } from 'bun:test';

import { createDefaultAppDeployManifest } from './projectTargets';
import { getAppConfigTs, getPackageJson } from './templates';

const WEB: AppDeployTargets = { web: { enabled: true } };
const ANDROID: AppDeployTargets = {
  android: {
    enabled: true,
    package: 'com.example.android',
    scheme: 'example-android',
  },
};
const IOS: AppDeployTargets = {
  ios: {
    enabled: true,
    bundleIdentifier: 'com.example.ios',
    scheme: 'example-ios',
  },
};

const COMBINATIONS: readonly (readonly [string, AppDeployTargets])[] = [
  ['web', WEB],
  ['android', ANDROID],
  ['ios', IOS],
  ['web+android', { ...WEB, ...ANDROID }],
  ['web+ios', { ...WEB, ...IOS }],
  ['android+ios', { ...ANDROID, ...IOS }],
  ['web+android+ios', { ...WEB, ...ANDROID, ...IOS }],
];

describe('canonical app target generation', () => {
  it.each(COMBINATIONS)(
    'emits only enabled target sections and scripts for %s',
    (_label, targets) => {
      const appConfig = getAppConfigTs({ name: 'Target App', slug: 'target-app', targets });
      const scripts = getPackageJson({ name: 'target-app', targets }).scripts as Readonly<
        Record<string, string>
      >;

      expect(appConfig.includes('  web: {')).toBe(targets.web?.enabled === true);
      expect(appConfig.includes('  android: {')).toBe(targets.android?.enabled === true);
      expect(appConfig.includes('  ios: {')).toBe(targets.ios?.enabled === true);
      expect('web' in scripts).toBe(targets.web?.enabled === true);
      expect('android' in scripts).toBe(targets.android?.enabled === true);
      expect('ios' in scripts).toBe(targets.ios?.enabled === true);
    },
  );

  it('keeps generated native identity independent from the slug', () => {
    const appConfig = getAppConfigTs({
      name: 'Target App',
      slug: 'renamed-slug',
      targets: { ...ANDROID, ...IOS },
    });

    expect(appConfig).toContain("package: 'com.example.android'");
    expect(appConfig).toContain("scheme: 'example-android'");
    expect(appConfig).toContain("bundleIdentifier: 'com.example.ios'");
    expect(appConfig).toContain("scheme: 'example-ios'");
    expect(appConfig).not.toContain('ankh-renamedslug');
  });

  it('persists the historical target identity for new projects', () => {
    expect(createDefaultAppDeployManifest('oauth-fixture-consumer')).toEqual({
      targets: {
        web: { enabled: true },
        android: {
          enabled: true,
          package: 'com.ankh.oauthfixtureconsumer',
          scheme: 'ankh-oauthfixtureconsumer',
        },
        ios: {
          enabled: true,
          bundleIdentifier: 'com.ankh.oauthfixtureconsumer',
          scheme: 'ankh-oauthfixtureconsumer',
        },
      },
    });
  });

  it('does not invent a native scheme when the canonical target omits one', () => {
    const appConfig = getAppConfigTs({
      name: 'Legacy Native App',
      slug: 'legacy-native-app',
      targets: {
        android: { enabled: true, package: 'com.example.legacy' },
      },
    });

    expect(appConfig).toContain("package: 'com.example.legacy'");
    expect(appConfig).not.toContain('scheme:');
  });
});
