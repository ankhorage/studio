import { describe, expect, it } from 'bun:test';

import { createGeneratedAppExtensionRegistrySource } from './generatedAppFiles';

describe('generated app extension interaction-policy support', () => {
  it('emits an explicit support map beside the generated component registry', () => {
    const source = createGeneratedAppExtensionRegistrySource({
      usesExpoBarcodeScannerAdapter: false,
      zoraExtensions: [
        {
          packageName: '@example/widgets',
          components: {
            DeclaredWidget: 'DeclaredWidget',
            RegisteredOnlyWidget: 'RegisteredOnlyWidget',
          },
          interactionPolicySupportedComponents: ['DeclaredWidget'],
        },
      ],
    });

    expect(source).toContain('DeclaredWidget: DeclaredWidget');
    expect(source).toContain('RegisteredOnlyWidget: RegisteredOnlyWidget');
    expect(source).toContain('export const APP_EXTENSION_INTERACTION_POLICY_SUPPORT = {');
    expect(source).toContain('DeclaredWidget: true');
    expect(source).not.toContain('RegisteredOnlyWidget: true');
  });

  it('rejects support declarations for node types absent from the registry', () => {
    expect(() =>
      createGeneratedAppExtensionRegistrySource({
        usesExpoBarcodeScannerAdapter: false,
        zoraExtensions: [
          {
            packageName: '@example/widgets',
            components: { RegisteredWidget: 'RegisteredWidget' },
            interactionPolicySupportedComponents: ['MissingWidget'],
          },
        ],
      }),
    ).toThrow('declares interaction-policy support for unregistered component MissingWidget');
  });

  it('emits an empty declaration instead of inferring support from registry membership', () => {
    const source = createGeneratedAppExtensionRegistrySource({
      usesExpoBarcodeScannerAdapter: false,
      zoraExtensions: [
        {
          packageName: '@example/widgets',
          components: { RegisteredOnlyWidget: 'RegisteredOnlyWidget' },
        },
      ],
    });

    expect(source).toMatch(
      /export const APP_EXTENSION_INTERACTION_POLICY_SUPPORT = \{\s*\} as const;/,
    );
    expect(source).not.toContain('RegisteredOnlyWidget: true');
  });
});
