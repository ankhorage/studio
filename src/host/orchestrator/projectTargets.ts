import type { AppDeployManifest } from '@ankhorage/contracts/deploy';

const RESERVED_NATIVE_IDENTIFIER_SEGMENTS = new Set(
  [
    'abstract',
    'annotation',
    'as',
    'break',
    'byte',
    'case',
    'catch',
    'char',
    'class',
    'companion',
    'const',
    'continue',
    'data',
    'do',
    'double',
    'else',
    'enum',
    'extends',
    'false',
    'final',
    'finally',
    'float',
    'for',
    'fun',
    'if',
    'implements',
    'import',
    'in',
    'int',
    'interface',
    'internal',
    'is',
    'long',
    'native',
    'new',
    'null',
    'object',
    'open',
    'operator',
    'out',
    'override',
    'package',
    'private',
    'protected',
    'public',
    'return',
    'sealed',
    'short',
    'static',
    'strictfp',
    'super',
    'suspend',
    'switch',
    'synchronized',
    'this',
    'throw',
    'throws',
    'transient',
    'true',
    'try',
    'typealias',
    'typeof',
    'val',
    'var',
    'void',
    'volatile',
    'when',
    'while',
  ].map((segment) => segment.toLowerCase()),
);

export function createDefaultAppDeployManifest(projectId: string): AppDeployManifest {
  const identifierSegment = createNativeIdentifierSegment(projectId);
  const applicationId = `com.ankh.${identifierSegment}`;
  const scheme = `ankh-${identifierSegment.replaceAll('_', '') || 'app'}`;

  return {
    targets: {
      web: { enabled: true },
      android: {
        enabled: true,
        package: applicationId,
        scheme,
      },
      ios: {
        enabled: true,
        bundleIdentifier: applicationId,
        scheme,
      },
    },
  };
}

function createNativeIdentifierSegment(projectId: string): string {
  const sanitized = projectId.replace(/[^A-Za-z0-9_]/g, '').toLowerCase();
  const ensuredValue = sanitized.length > 0 ? sanitized : 'app';
  const leadingLetterSegment = /^[a-z]/u.test(ensuredValue) ? ensuredValue : `app${ensuredValue}`;

  return RESERVED_NATIVE_IDENTIFIER_SEGMENTS.has(leadingLetterSegment)
    ? `app${leadingLetterSegment}`
    : leadingLetterSegment;
}
