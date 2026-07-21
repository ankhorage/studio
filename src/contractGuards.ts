import { COLOR_HARMONIES, type ColorHarmony } from '@ankhorage/color-theory';
import {
  APP_API_ENDPOINT_INTENTS,
  APP_API_ENDPOINT_METHODS,
  APP_API_GENERATED_PRESETS,
  APP_API_KINDS,
  APP_CATEGORIES,
  type AppCategory,
  type AppDataManifest,
  type AppManifest,
  type AppSettings,
  AUTH_OAUTH_PROVIDER_IDS,
  AUTH_PROFILE_CREATE_STRATEGIES,
  AUTH_PROFILE_PRIMARY_KEY_STRATEGIES,
  AUTH_PROFILE_UPDATE_STRATEGIES,
  AUTH_SCOPES,
  AUTH_SIGN_IN_IDENTIFIERS,
  AUTH_SIGN_UP_POLICIES,
  type AuthSpec,
  AUTHZ_ENGINES,
  AUTHZ_KINDS,
  type ComponentDataBindingRegistry,
  DATABASE_TIERS,
  type DatabaseSpec,
  type DataSourceRegistry,
  type DeploymentSpec,
  type InfraManifest,
  NAVIGATOR_TYPES,
  type NavigatorSpec,
  type NavigatorType,
  type NetworkingSpec,
  type RouteDefinition,
  type ScreenSpec,
  type SplashScreenSpec,
  STATE_PERSISTENCE_MODES,
  type StateSpec,
  STORAGE_PROVIDERS,
  type StorageSpec,
  type ThemeConfig,
  type ThemeModeConfig,
  type UiNode,
} from '@ankhorage/contracts';

const APP_CATEGORY_SET = new Set<string>(APP_CATEGORIES);
const APP_API_ENDPOINT_INTENT_SET = new Set<string>(APP_API_ENDPOINT_INTENTS);
const APP_API_ENDPOINT_METHOD_SET = new Set<string>(APP_API_ENDPOINT_METHODS);
const APP_API_GENERATED_PRESET_SET = new Set<string>(APP_API_GENERATED_PRESETS);
const APP_API_KIND_SET = new Set<string>(APP_API_KINDS);
const AUTH_OAUTH_PROVIDER_SET = new Set<string>(AUTH_OAUTH_PROVIDER_IDS);
const AUTH_PROFILE_CREATE_STRATEGY_SET = new Set<string>(AUTH_PROFILE_CREATE_STRATEGIES);
const AUTH_PROFILE_PRIMARY_KEY_STRATEGY_SET = new Set<string>(AUTH_PROFILE_PRIMARY_KEY_STRATEGIES);
const AUTH_PROFILE_UPDATE_STRATEGY_SET = new Set<string>(AUTH_PROFILE_UPDATE_STRATEGIES);
const AUTH_SCOPE_SET = new Set<string>(AUTH_SCOPES);
const AUTH_SIGN_IN_IDENTIFIER_SET = new Set<string>(AUTH_SIGN_IN_IDENTIFIERS);
const AUTH_SIGN_UP_POLICY_SET = new Set<string>(AUTH_SIGN_UP_POLICIES);
const AUTHZ_ENGINE_SET = new Set<string>(AUTHZ_ENGINES);
const AUTHZ_KIND_SET = new Set<string>(AUTHZ_KINDS);
const COLOR_HARMONY_SET = new Set<string>(COLOR_HARMONIES);
const DATABASE_TIER_SET = new Set<string>(DATABASE_TIERS);
const NAVIGATOR_TYPE_SET = new Set<string>(NAVIGATOR_TYPES);
const SPLASH_SCREEN_RESIZE_MODE_SET = new Set<string>(['contain', 'cover', 'native']);
const STATE_PERSISTENCE_MODE_SET = new Set<string>(STATE_PERSISTENCE_MODES);
const STORAGE_PROVIDER_SET = new Set<string>(STORAGE_PROVIDERS);

export function isAppCategory(value: unknown): value is AppCategory {
  return typeof value === 'string' && APP_CATEGORY_SET.has(value);
}

export function isColorHarmony(value: unknown): value is ColorHarmony {
  return typeof value === 'string' && COLOR_HARMONY_SET.has(value);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isOptionalString(value: unknown): boolean {
  return value === undefined || typeof value === 'string';
}

function isOptionalNumber(value: unknown): boolean {
  return value === undefined || typeof value === 'number';
}

function isOptionalBoolean(value: unknown): boolean {
  return value === undefined || typeof value === 'boolean';
}

function isStringArray(value: unknown): value is string[] {
  return Array.isArray(value) && value.every((entry) => typeof entry === 'string');
}

function isManifestValue(value: unknown): boolean {
  if (
    value === null ||
    typeof value === 'string' ||
    typeof value === 'number' ||
    typeof value === 'boolean'
  ) {
    return true;
  }

  if (Array.isArray(value)) {
    return value.every(isManifestValue);
  }

  return isRecord(value) && Object.values(value).every(isManifestValue);
}

function isNavigatorType(value: unknown): value is NavigatorType {
  return typeof value === 'string' && NAVIGATOR_TYPE_SET.has(value);
}

function isThemeModeConfig(value: unknown): value is ThemeModeConfig {
  return isRecord(value) && typeof value.primaryColor === 'string' && isColorHarmony(value.harmony);
}

function isThemeConfig(value: unknown): value is ThemeConfig {
  return (
    isRecord(value) &&
    typeof value.id === 'string' &&
    typeof value.name === 'string' &&
    isThemeModeConfig(value.light) &&
    isThemeModeConfig(value.dark)
  );
}

function isUiNode(value: unknown): value is UiNode {
  return (
    isRecord(value) &&
    typeof value.id === 'string' &&
    typeof value.type === 'string' &&
    (value.alias === undefined || typeof value.alias === 'string') &&
    (value.props === undefined || isRecord(value.props)) &&
    (value.style === undefined || isRecord(value.style)) &&
    (value.repeat === undefined ||
      (isRecord(value.repeat) &&
        isBindingValueSource(value.repeat.source) &&
        isOptionalString(value.repeat.itemAlias) &&
        isOptionalString(value.repeat.keyPath) &&
        (value.repeat.empty === undefined ||
          (Array.isArray(value.repeat.empty) && value.repeat.empty.every(isUiNode))))) &&
    (value.children === undefined ||
      (Array.isArray(value.children) && value.children.every(isUiNode)))
  );
}

function isScreenSpec(value: unknown): value is ScreenSpec {
  return (
    isRecord(value) &&
    typeof value.id === 'string' &&
    typeof value.name === 'string' &&
    (value.title === undefined || typeof value.title === 'string') &&
    (value.description === undefined || typeof value.description === 'string') &&
    (value.dataLoaders === undefined ||
      (Array.isArray(value.dataLoaders) &&
        value.dataLoaders.every(isScreenDataLoaderDefinition))) &&
    (value.requires === undefined || isScreenRequirements(value.requires)) &&
    isUiNode(value.root)
  );
}

function isRouteDefinition(value: unknown): value is RouteDefinition {
  return (
    isRecord(value) &&
    typeof value.name === 'string' &&
    (value.path === undefined || typeof value.path === 'string') &&
    (value.label === undefined || typeof value.label === 'string') &&
    (value.icon === undefined || isIconSpec(value.icon)) &&
    (value.hideInTabBar === undefined || typeof value.hideInTabBar === 'boolean') &&
    (value.guards === undefined ||
      (Array.isArray(value.guards) && value.guards.every((guard) => typeof guard === 'string'))) &&
    (value.screenId === undefined || typeof value.screenId === 'string') &&
    (value.navigator === undefined || isNavigatorSpec(value.navigator))
  );
}

function isNavigatorSpec(value: unknown): value is NavigatorSpec {
  return (
    isRecord(value) &&
    isNavigatorType(value.type) &&
    (value.initialRouteName === undefined || typeof value.initialRouteName === 'string') &&
    Array.isArray(value.routes) &&
    value.routes.every(isRouteDefinition) &&
    (value.options === undefined || isRecord(value.options))
  );
}

function isSplashScreenModeSpec(value: unknown): boolean {
  return (
    isRecord(value) &&
    isOptionalString(value.image) &&
    isOptionalNumber(value.imageWidth) &&
    (value.resizeMode === undefined ||
      (typeof value.resizeMode === 'string' &&
        SPLASH_SCREEN_RESIZE_MODE_SET.has(value.resizeMode))) &&
    isOptionalString(value.backgroundColor)
  );
}

function isSplashScreenSpec(value: unknown): value is SplashScreenSpec {
  return (
    isRecord(value) &&
    isSplashScreenModeSpec(value) &&
    (value.dark === undefined || isSplashScreenModeSpec(value.dark))
  );
}

function isDeploymentSpec(value: unknown): value is DeploymentSpec {
  return (
    isRecord(value) && typeof value.target === 'string' && typeof value.monitoring === 'boolean'
  );
}

function isDatabaseSpec(value: unknown): value is DatabaseSpec {
  return (
    isRecord(value) &&
    typeof value.provider === 'string' &&
    typeof value.tier === 'string' &&
    DATABASE_TIER_SET.has(value.tier)
  );
}

function isStorageSpec(value: unknown): value is StorageSpec {
  return (
    isRecord(value) &&
    typeof value.provider === 'string' &&
    STORAGE_PROVIDER_SET.has(value.provider) &&
    isStringArray(value.buckets)
  );
}

function isStateSpec(value: unknown): value is StateSpec {
  return (
    isRecord(value) &&
    typeof value.provider === 'string' &&
    (value.persistence === undefined ||
      (typeof value.persistence === 'string' && STATE_PERSISTENCE_MODE_SET.has(value.persistence)))
  );
}

function isNetworkingSpec(value: unknown): value is NetworkingSpec {
  return isRecord(value) && isOptionalString(value.domain) && typeof value.cdn === 'boolean';
}

function isAuthSpec(value: unknown): value is AuthSpec {
  return (
    isRecord(value) &&
    typeof value.scope === 'string' &&
    AUTH_SCOPE_SET.has(value.scope) &&
    typeof value.provider === 'string' &&
    (value.authorization === undefined ||
      (isRecord(value.authorization) &&
        typeof value.authorization.kind === 'string' &&
        AUTHZ_KIND_SET.has(value.authorization.kind) &&
        typeof value.authorization.engine === 'string' &&
        AUTHZ_ENGINE_SET.has(value.authorization.engine))) &&
    (value.flow === undefined || isAuthFlow(value.flow)) &&
    (value.signIn === undefined ||
      (isRecord(value.signIn) &&
        Array.isArray(value.signIn.identifiers) &&
        value.signIn.identifiers.every(
          (identifier) =>
            typeof identifier === 'string' && AUTH_SIGN_IN_IDENTIFIER_SET.has(identifier),
        ))) &&
    (value.signUp === undefined ||
      (isRecord(value.signUp) &&
        isStringArray(value.signUp.requiredFields) &&
        (value.signUp.optionalFields === undefined || isStringArray(value.signUp.optionalFields)) &&
        (value.signUp.signUpPolicy === undefined ||
          (typeof value.signUp.signUpPolicy === 'string' &&
            AUTH_SIGN_UP_POLICY_SET.has(value.signUp.signUpPolicy))))) &&
    (value.oauth === undefined || isAuthOAuthConfig(value.oauth)) &&
    (value.profile === undefined || isAuthProfileSpec(value.profile))
  );
}

function isAuthFlow(value: unknown): boolean {
  return (
    isRecord(value) &&
    typeof value.signInRoute === 'string' &&
    isOptionalString(value.signUpRoute) &&
    isOptionalString(value.signOutRoute) &&
    isOptionalString(value.forgotPasswordRoute) &&
    isOptionalString(value.otpRoute) &&
    typeof value.postSignInRoute === 'string' &&
    isOptionalString(value.unauthorizedRoute)
  );
}

function isAuthOAuthConfig(value: unknown): boolean {
  return (
    isRecord(value) &&
    typeof value.enabled === 'boolean' &&
    typeof value.callbackRoute === 'string' &&
    Array.isArray(value.providers) &&
    value.providers.every(
      (provider) =>
        isRecord(provider) &&
        typeof provider.id === 'string' &&
        (AUTH_OAUTH_PROVIDER_SET.has(provider.id) || provider.id.length > 0) &&
        isOptionalString(provider.label) &&
        isOptionalBoolean(provider.enabled) &&
        (provider.scopes === undefined || isStringArray(provider.scopes)) &&
        (provider.queryParams === undefined ||
          (isRecord(provider.queryParams) &&
            Object.values(provider.queryParams).every((entry) => typeof entry === 'string'))) &&
        (provider.icon === undefined || isIconSpec(provider.icon)) &&
        (provider.credentialsRef === undefined || isSecretRef(provider.credentialsRef)),
    )
  );
}

function isAuthProfileSpec(value: unknown): boolean {
  return (
    isRecord(value) &&
    isStringArray(value.fields) &&
    isOptionalString(value.table) &&
    (value.primaryKey === undefined ||
      (typeof value.primaryKey === 'string' &&
        AUTH_PROFILE_PRIMARY_KEY_STRATEGY_SET.has(value.primaryKey))) &&
    (value.createStrategy === undefined ||
      (typeof value.createStrategy === 'string' &&
        AUTH_PROFILE_CREATE_STRATEGY_SET.has(value.createStrategy))) &&
    (value.updateStrategy === undefined ||
      (typeof value.updateStrategy === 'string' &&
        AUTH_PROFILE_UPDATE_STRATEGY_SET.has(value.updateStrategy)))
  );
}

function isInfraManifest(value: unknown): value is InfraManifest {
  return (
    isRecord(value) &&
    (value.deployment === undefined || isDeploymentSpec(value.deployment)) &&
    (value.auth === undefined || isAuthSpec(value.auth)) &&
    (value.database === undefined || isDatabaseSpec(value.database)) &&
    (value.storage === undefined || isStorageSpec(value.storage)) &&
    (value.state === undefined || isStateSpec(value.state)) &&
    (value.networking === undefined || isNetworkingSpec(value.networking)) &&
    Array.isArray(value.plugins) &&
    value.plugins.every((plugin) => typeof plugin === 'string') &&
    (value.pluginsConfig === undefined || isRecord(value.pluginsConfig))
  );
}

function isAppSettings(value: unknown): value is AppSettings {
  return (
    isRecord(value) &&
    isRecord(value.localization) &&
    typeof value.localization.defaultLocale === 'string' &&
    Array.isArray(value.localization.locales) &&
    value.localization.locales.every((locale) => typeof locale === 'string') &&
    (value.apiBaseUrl === undefined || typeof value.apiBaseUrl === 'string')
  );
}

function isScreenRegistry(value: unknown): value is Record<string, ScreenSpec> {
  return isRecord(value) && Object.values(value).every(isScreenSpec);
}

function isIconSpec(value: unknown): boolean {
  return (
    isRecord(value) &&
    typeof value.name === 'string' &&
    isOptionalString(value.provider) &&
    (value.size === undefined ||
      typeof value.size === 'string' ||
      typeof value.size === 'number') &&
    isOptionalString(value.color)
  );
}

function isSecretRef(value: unknown): boolean {
  return typeof value === 'string';
}

function isCredentialRef(value: unknown): boolean {
  return (
    isRecord(value) &&
    typeof value.id === 'string' &&
    typeof value.kind === 'string' &&
    isOptionalString(value.label) &&
    isOptionalString(value.scope)
  );
}

function isAdapterRef(value: unknown): boolean {
  return (
    isRecord(value) &&
    typeof value.id === 'string' &&
    typeof value.kind === 'string' &&
    isOptionalString(value.packageName) &&
    isOptionalString(value.exportName) &&
    (value.config === undefined || isManifestValue(value.config))
  );
}

function isScreenRequirements(value: unknown): boolean {
  return (
    isRecord(value) &&
    (value.permissions === undefined ||
      (Array.isArray(value.permissions) &&
        value.permissions.every(
          (entry) => isRecord(entry) && typeof entry.permission === 'string',
        ))) &&
    (value.capabilities === undefined ||
      (Array.isArray(value.capabilities) &&
        value.capabilities.every(
          (entry) => isRecord(entry) && typeof entry.capability === 'string',
        )))
  );
}

function isAppDataManifest(value: unknown): value is AppDataManifest {
  return (
    isRecord(value) &&
    (value.apis === undefined ||
      (isRecord(value.apis) && Object.values(value.apis).every(isAppApiDefinition)))
  );
}

function isAppApiDefinition(value: unknown): boolean {
  return (
    isRecord(value) &&
    typeof value.id === 'string' &&
    typeof value.kind === 'string' &&
    APP_API_KIND_SET.has(value.kind) &&
    isOptionalString(value.label) &&
    isOptionalString(value.description) &&
    typeof value.basePath === 'string' &&
    Array.isArray(value.endpoints) &&
    value.endpoints.every(isAppApiEndpointDefinition) &&
    (value.auth === undefined || isAppApiAuthRequirement(value.auth)) &&
    (value.metadata === undefined || isManifestValue(value.metadata)) &&
    (value.kind !== 'generated' ||
      ((value.preset === undefined ||
        (typeof value.preset === 'string' && APP_API_GENERATED_PRESET_SET.has(value.preset))) &&
        (value.resource === undefined || isAppApiResourceDefinition(value.resource)))) &&
    (value.kind !== 'external' ||
      (isOptionalString(value.baseUrl) && isOptionalString(value.openApiUrl)))
  );
}

function isAppApiEndpointDefinition(value: unknown): boolean {
  return (
    isRecord(value) &&
    typeof value.id === 'string' &&
    isOptionalString(value.label) &&
    isOptionalString(value.description) &&
    typeof value.method === 'string' &&
    APP_API_ENDPOINT_METHOD_SET.has(value.method) &&
    typeof value.path === 'string' &&
    (value.intent === undefined ||
      (typeof value.intent === 'string' && APP_API_ENDPOINT_INTENT_SET.has(value.intent))) &&
    (value.request === undefined || isDataOperationRequest(value.request)) &&
    (value.response === undefined || isDataOperationResponse(value.response)) &&
    (value.auth === undefined || isAppApiAuthRequirement(value.auth)) &&
    (value.metadata === undefined || isManifestValue(value.metadata))
  );
}

function isAppApiAuthRequirement(value: unknown): boolean {
  return (
    isRecord(value) &&
    isOptionalBoolean(value.required) &&
    (value.roles === undefined || isStringArray(value.roles)) &&
    (value.permissions === undefined || isStringArray(value.permissions)) &&
    isOptionalString(value.policy) &&
    (value.metadata === undefined || isManifestValue(value.metadata))
  );
}

function isAppApiResourceDefinition(value: unknown): boolean {
  return (
    isRecord(value) &&
    value.kind === 'collection' &&
    isDbCollectionDefinition(value.collection) &&
    (value.seed === undefined ||
      (Array.isArray(value.seed) &&
        value.seed.every(
          (record) => isRecord(record) && Object.values(record).every(isManifestValue),
        ))) &&
    (value.metadata === undefined || isManifestValue(value.metadata))
  );
}

function isDbCollectionDefinition(value: unknown): boolean {
  return (
    isRecord(value) &&
    typeof value.name === 'string' &&
    isOptionalString(value.schema) &&
    Array.isArray(value.fields) &&
    value.fields.every(
      (field) =>
        isRecord(field) &&
        typeof field.name === 'string' &&
        typeof field.type === 'string' &&
        ['text', 'number', 'boolean', 'datetime', 'json', 'uuid'].includes(field.type) &&
        isOptionalBoolean(field.required) &&
        isOptionalBoolean(field.unique) &&
        (field.defaultValue === undefined || isManifestValue(field.defaultValue)),
    ) &&
    isOptionalString(value.primaryKey)
  );
}

function isDataSourceRegistry(value: unknown): value is DataSourceRegistry {
  return isRecord(value) && Object.values(value).every(isDataSourceConfig);
}

function isDataSourceConfig(value: unknown): boolean {
  return (
    isRecord(value) &&
    typeof value.id === 'string' &&
    typeof value.kind === 'string' &&
    ['database', 'graphql', 'managed-api', 'openapi', 'rest'].includes(value.kind) &&
    isOptionalString(value.name) &&
    isOptionalString(value.description) &&
    (value.credential === undefined || isCredentialRef(value.credential)) &&
    isDataEndpointRegistry(value.endpoints) &&
    (value.schemas === undefined || isRecord(value.schemas)) &&
    (value.metadata === undefined || isManifestValue(value.metadata)) &&
    (value.kind !== 'rest' || typeof value.baseUrl === 'string') &&
    (value.kind !== 'openapi' ||
      (isOptionalString(value.baseUrl) &&
        (value.import === undefined ||
          (isRecord(value.import) &&
            isOptionalString(value.import.url) &&
            isOptionalString(value.import.documentId) &&
            isOptionalString(value.import.version))))) &&
    (value.kind !== 'graphql' ||
      (typeof value.endpointUrl === 'string' &&
        (value.introspection === undefined ||
          (isRecord(value.introspection) &&
            typeof value.introspection.enabled === 'boolean' &&
            isOptionalString(value.introspection.schemaVersion))))) &&
    (value.kind !== 'database' || isAdapterRef(value.adapter)) &&
    (value.kind !== 'managed-api' ||
      (isAdapterRef(value.adapter) &&
        Array.isArray(value.resources) &&
        value.resources.every(isManagedApiResourceConfig)))
  );
}

function isManagedApiResourceConfig(value: unknown): boolean {
  return (
    isRecord(value) &&
    typeof value.name === 'string' &&
    isDbCollectionDefinition(value.collection) &&
    (value.operations === undefined ||
      (Array.isArray(value.operations) &&
        value.operations.every((operation) =>
          ['create', 'delete', 'list', 'read', 'update'].includes(String(operation)),
        ))) &&
    (value.metadata === undefined || isManifestValue(value.metadata))
  );
}

function isDataEndpointRegistry(value: unknown): boolean {
  return isRecord(value) && Object.values(value).every(isDataEndpointConfig);
}

function isDataEndpointConfig(value: unknown): boolean {
  return (
    isRecord(value) &&
    typeof value.id === 'string' &&
    typeof value.kind === 'string' &&
    isOptionalString(value.name) &&
    isOptionalString(value.description) &&
    isOptionalString(value.baseUrl) &&
    isOptionalString(value.path) &&
    (value.credential === undefined || isCredentialRef(value.credential)) &&
    isRecord(value.operations) &&
    Object.values(value.operations).every(isDataOperationConfig) &&
    (value.metadata === undefined || isManifestValue(value.metadata))
  );
}

function isDataOperationConfig(value: unknown): boolean {
  return (
    isRecord(value) &&
    typeof value.id === 'string' &&
    isOptionalString(value.endpointId) &&
    isOptionalString(value.name) &&
    isOptionalString(value.description) &&
    typeof value.protocol === 'string' &&
    typeof value.intent === 'string' &&
    ['action', 'create', 'delete', 'read', 'update'].includes(value.intent) &&
    isOptionalString(value.method) &&
    isOptionalString(value.path) &&
    (value.request === undefined || isDataOperationRequest(value.request)) &&
    (value.response === undefined || isDataOperationResponse(value.response)) &&
    (value.pagination === undefined || isRecord(value.pagination)) &&
    (value.credential === undefined || isCredentialRef(value.credential)) &&
    (value.metadata === undefined || isManifestValue(value.metadata))
  );
}

function isDataOperationRequest(value: unknown): boolean {
  return (
    isRecord(value) &&
    isDataSchemaSlot(value) &&
    (value.parameters === undefined ||
      (Array.isArray(value.parameters) && value.parameters.every(isDataOperationParameter)))
  );
}

function isDataOperationParameter(value: unknown): boolean {
  return (
    isRecord(value) &&
    isDataSchemaSlot(value) &&
    typeof value.name === 'string' &&
    typeof value.location === 'string' &&
    ['body', 'cookie', 'header', 'path', 'query'].includes(value.location) &&
    isOptionalBoolean(value.required) &&
    isOptionalString(value.description) &&
    (value.default === undefined || isManifestValue(value.default))
  );
}

function isDataOperationResponse(value: unknown): boolean {
  return (
    isRecord(value) &&
    isDataSchemaSlot(value) &&
    (value.status === undefined ||
      typeof value.status === 'string' ||
      typeof value.status === 'number') &&
    isOptionalString(value.contentType) &&
    isOptionalString(value.description)
  );
}

function isDataSchemaSlot(value: unknown): boolean {
  return isRecord(value) && (value.schema === undefined || isRecord(value.schema));
}

function isComponentDataBindingRegistry(value: unknown): value is ComponentDataBindingRegistry {
  return isRecord(value) && Object.values(value).every(isComponentDataBinding);
}

function isComponentDataBinding(value: unknown): boolean {
  return (
    isRecord(value) &&
    typeof value.componentId === 'string' &&
    isOptionalString(value.componentType) &&
    (value.props === undefined ||
      (isRecord(value.props) && Object.values(value.props).every(isPropBinding))) &&
    (value.events === undefined ||
      (isRecord(value.events) &&
        Object.values(value.events).every(
          (bindings) => Array.isArray(bindings) && bindings.every(isEventBinding),
        )))
  );
}

function isPropBinding(value: unknown): boolean {
  return (
    isRecord(value) &&
    isBindingValueSource(value.source) &&
    (value.fallback === undefined || isBindingFallback(value.fallback)) &&
    (value.loading === undefined || isBindingLifecycleBehavior(value.loading)) &&
    (value.error === undefined || isBindingLifecycleBehavior(value.error)) &&
    (value.empty === undefined || isBindingLifecycleBehavior(value.empty)) &&
    isOptionalBindingTransforms(value.transforms)
  );
}

function isEventBinding(value: unknown): boolean {
  return (
    isRecord(value) &&
    ((isRecord(value.target) &&
      value.target.kind === 'action' &&
      typeof value.target.type === 'string') ||
      (isRecord(value.target) &&
        value.target.kind === 'operation' &&
        isBindingOperationRef(value.target.operation))) &&
    (value.input === undefined || isBindingInputMap(value.input)) &&
    (value.when === undefined ||
      (isRecord(value.when) &&
        isBindingValueSource(value.when.source) &&
        ['eq', 'exists', 'neq', 'notExists'].includes(String(value.when.operator)) &&
        (value.when.value === undefined || isManifestValue(value.when.value))))
  );
}

function isBindingValueSource(value: unknown): boolean {
  return (
    isRecord(value) &&
    typeof value.kind === 'string' &&
    ['context', 'event', 'literal', 'operation', 'state'].includes(value.kind) &&
    (value.kind === 'literal'
      ? isManifestValue(value.value)
      : value.kind === 'operation'
        ? isBindingOperationRef(value.operation) && isOptionalString(value.path)
        : typeof value.path === 'string')
  );
}

function isBindingOperationRef(value: unknown): boolean {
  return (
    isRecord(value) &&
    typeof value.dataSourceId === 'string' &&
    typeof value.operationId === 'string' &&
    isOptionalString(value.endpointId)
  );
}

function isBindingFallback(value: unknown): boolean {
  return (
    isRecord(value) &&
    (value.value === undefined || isManifestValue(value.value)) &&
    (value.source === undefined || isBindingValueSource(value.source))
  );
}

function isBindingLifecycleBehavior(value: unknown): boolean {
  return (
    isRecord(value) &&
    typeof value.state === 'string' &&
    ['empty', 'error', 'loading'].includes(value.state) &&
    (value.fallback === undefined || isBindingFallback(value.fallback)) &&
    isOptionalString(value.message)
  );
}

function isOptionalBindingTransforms(value: unknown): boolean {
  return (
    value === undefined ||
    (Array.isArray(value) &&
      value.every((transform) => ['lowercase', 'trim', 'uppercase'].includes(String(transform))))
  );
}

function isScreenDataLoaderDefinition(value: unknown): boolean {
  return (
    isRecord(value) &&
    typeof value.kind === 'string' &&
    ((value.kind === 'api' &&
      typeof value.apiId === 'string' &&
      ['byId', 'list', 'one', 'random'].includes(String(value.mode)) &&
      typeof value.targetPath === 'string' &&
      (value.id === undefined || typeof value.id === 'string' || typeof value.id === 'number')) ||
      (value.kind === 'operation' &&
        isOptionalString(value.id) &&
        isBindingOperationRef(value.operation) &&
        (value.input === undefined || isBindingInputMap(value.input))))
  );
}

function isBindingInputMap(value: unknown): boolean {
  return isRecord(value) && Object.values(value).every(isBindingInputValue);
}

function isBindingInputValue(value: unknown): boolean {
  return (
    isRecord(value) &&
    typeof value.kind === 'string' &&
    ((value.kind === 'array' &&
      Array.isArray(value.items) &&
      value.items.every(isBindingInputValue)) ||
      (value.kind === 'literal' && isManifestValue(value.value)) ||
      (value.kind === 'object' && isBindingInputMap(value.fields)) ||
      (value.kind === 'source' &&
        isBindingValueSource(value.source) &&
        isOptionalBindingTransforms(value.transforms)))
  );
}

export function isAppManifest(value: unknown): value is AppManifest {
  return (
    isRecord(value) &&
    isRecord(value.metadata) &&
    typeof value.metadata.name === 'string' &&
    typeof value.metadata.slug === 'string' &&
    typeof value.metadata.version === 'string' &&
    isAppCategory(value.metadata.category) &&
    typeof value.metadata.themeId === 'string' &&
    (value.metadata.created === undefined || typeof value.metadata.created === 'string') &&
    (value.metadata.updated === undefined || typeof value.metadata.updated === 'string') &&
    Array.isArray(value.themes) &&
    value.themes.every(isThemeConfig) &&
    typeof value.activeThemeId === 'string' &&
    (value.activeThemeMode === undefined ||
      value.activeThemeMode === 'dark' ||
      value.activeThemeMode === 'light') &&
    (value.splashScreen === undefined || isSplashScreenSpec(value.splashScreen)) &&
    isInfraManifest(value.infra) &&
    isNavigatorSpec(value.navigator) &&
    isScreenRegistry(value.screens) &&
    (value.data === undefined || isAppDataManifest(value.data)) &&
    (value.dataSources === undefined || isDataSourceRegistry(value.dataSources)) &&
    (value.dataBindings === undefined || isComponentDataBindingRegistry(value.dataBindings)) &&
    isAppSettings(value.settings)
  );
}
