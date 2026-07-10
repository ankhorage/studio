import {
  AUTH_PROVIDERS,
  AUTH_SCOPES,
  AUTHZ_ENGINES,
  DATABASE_PROVIDERS,
  DEPLOYMENT_TARGETS,
  type InfraManifest,
} from '@ankhorage/contracts';

export function validateInfraSupport(manifest: InfraManifest): string[] {
  const warnings: string[] = [];

  const deploymentTarget = manifest.deployment?.target;
  if (deploymentTarget && !isSupported(deploymentTarget, DEPLOYMENT_TARGETS)) {
    warnings.push(
      warningForUnsupportedValue({
        path: 'infra.deployment.target',
        value: deploymentTarget,
        supported: DEPLOYMENT_TARGETS,
      }),
    );
  }

  const databaseProvider = manifest.database?.provider;
  if (databaseProvider && !isSupported(databaseProvider, DATABASE_PROVIDERS)) {
    warnings.push(
      warningForUnsupportedValue({
        path: 'infra.database.provider',
        value: databaseProvider,
        supported: DATABASE_PROVIDERS,
      }),
    );
  }

  const authProvider = manifest.auth?.provider;
  if (authProvider && !isSupported(authProvider, AUTH_PROVIDERS)) {
    warnings.push(
      warningForUnsupportedValue({
        path: 'infra.auth.provider',
        value: authProvider,
        supported: AUTH_PROVIDERS,
      }),
    );
  }

  const authScope = manifest.auth?.scope;
  if (authScope && !isSupported(authScope, AUTH_SCOPES)) {
    warnings.push(
      warningForUnsupportedValue({
        path: 'infra.auth.scope',
        value: authScope,
        supported: AUTH_SCOPES,
      }),
    );
  }

  const authzEngine = manifest.auth?.authorization.engine;
  if (authzEngine && !isSupported(authzEngine, AUTHZ_ENGINES)) {
    warnings.push(
      warningForUnsupportedValue({
        path: 'infra.auth.authorization.engine',
        value: authzEngine,
        supported: AUTHZ_ENGINES,
      }),
    );
  }

  return warnings;
}

function warningForUnsupportedValue(args: {
  path: string;
  value: string;
  supported: readonly string[];
}) {
  const { path, value, supported } = args;
  return `${path} "${value}" is not currently supported by implemented generators. Supported values: ${formatSupportedValues(supported)}.`;
}

function isSupported(value: string, supported: readonly string[]): boolean {
  return supported.includes(value);
}

function formatSupportedValues(values: readonly string[]): string {
  if (values.length === 0) {
    return '(none)';
  }

  return values.join(', ');
}
