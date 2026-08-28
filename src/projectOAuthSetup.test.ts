import type { AppManifest } from '@ankhorage/contracts';
import { APP_DEPLOY_ENVIRONMENT_IDS, type AppDeployTargetId } from '@ankhorage/contracts/deploy';
import { describe, expect, test } from 'bun:test';

import { resolveProjectEnabledTargets, resolveProjectOAuthSetupPlan } from './projectOAuthSetup';

const TARGET_COMBINATIONS: readonly (readonly AppDeployTargetId[])[] = [
  ['web'],
  ['android'],
  ['ios'],
  ['web', 'android'],
  ['web', 'ios'],
  ['android', 'ios'],
  ['web', 'android', 'ios'],
];

function createManifest(enabledTargets: readonly AppDeployTargetId[]): AppManifest {
  const enabled = new Set(enabledTargets);
  return {
    metadata: {
      name: 'Demo',
      slug: 'demo',
      version: '1.0.0',
      category: 'developer_tools',
      themeId: 'default',
    },
    settings: { localization: { defaultLocale: 'en', locales: ['en'] } },
    deploy: {
      targets: {
        web: { enabled: enabled.has('web') },
        android: {
          enabled: enabled.has('android'),
          package: 'com.ankh.demo',
          scheme: 'ankh-demo',
        },
        ios: {
          enabled: enabled.has('ios'),
          bundleIdentifier: 'com.ankh.demo',
          scheme: 'ankh-demo',
        },
      },
    },
    infra: { modules: [] },
    navigator: { type: 'stack', routes: [] },
    screens: {},
    themes: [],
    activeThemeId: 'default',
  };
}

describe('project OAuth setup planning', () => {
  for (const environment of APP_DEPLOY_ENVIRONMENT_IDS) {
    for (const targets of TARGET_COMBINATIONS) {
      test(`${environment} ${targets.join('+')}`, () => {
        const manifest = createManifest(targets);
        const plan = resolveProjectOAuthSetupPlan({
          manifest,
          provider: 'google',
          environment,
        });

        expect(plan).not.toBeNull();
        if (!plan) return;

        expect(plan.environment).toBe(environment);
        expect(plan.targets).toEqual(targets);
        expect(
          plan.requirements.flatMap((requirement) =>
            requirement.kind === 'field' ? [requirement.key] : [],
          ),
        ).toEqual(['clientId', 'clientSecret']);
        expect(
          plan.requirements.filter(
            (requirement) => requirement.kind === 'callback' && requirement.role === 'provider',
          ),
        ).toHaveLength(1);
        expect(
          plan.requirements.flatMap((requirement) =>
            requirement.kind === 'callback' &&
            requirement.role === 'app' &&
            requirement.target !== undefined
              ? [requirement.target]
              : [],
          ),
        ).toEqual([...targets]);
      });
    }
  }

  test('rejects missing canonical target state', () => {
    const manifest = createManifest(['web']);
    const { deploy: _deploy, ...targetlessManifest } = manifest;

    expect(() => resolveProjectEnabledTargets(targetlessManifest)).toThrow(
      "Project 'demo' is missing canonical deploy.targets generation state.",
    );
  });
});
