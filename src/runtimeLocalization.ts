import type {
  RuntimeNodePropsResolver,
  RuntimeResolveNodePropsArgs,
} from '@ankhorage/contracts/runtime';

export const STUDIO_LOCALIZED_PROP_PAIRS = [
  ['i18nKey', 'text'],
  ['titleI18nKey', 'title'],
  ['descriptionI18nKey', 'description'],
  ['eyebrowI18nKey', 'eyebrow'],
  ['labelI18nKey', 'label'],
  ['helperTextI18nKey', 'helperText'],
  ['errorTextI18nKey', 'errorText'],
  ['metaI18nKey', 'meta'],
  ['childrenI18nKey', 'children'],
] as const;

export type StudioLocalizedPropPair = (typeof STUDIO_LOCALIZED_PROP_PAIRS)[number];
export type StudioRuntimeNodePropsResolver = RuntimeNodePropsResolver;
export type StudioRuntimeNodePropsResolverContext = RuntimeResolveNodePropsArgs;

export interface StudioRuntimeActionHandlerContext {
  action: unknown;
  context: RuntimeResolveNodePropsArgs;
}

export type StudioRuntimeActionHandlers = Record<
  string,
  (context: StudioRuntimeActionHandlerContext) => void
>;

function isNonEmptyString(value: unknown): value is string {
  return typeof value === 'string' && value.length > 0;
}

function hasOwnProp(props: Record<string, unknown>, key: string): boolean {
  return Object.prototype.hasOwnProperty.call(props, key);
}

export function resolveLocalizedPropValue(args: {
  props: Record<string, unknown>;
  keyProp: string;
  targetProp: string;
  translate: (key: string) => string;
}): string | undefined {
  const { props, keyProp, targetProp, translate } = args;
  const key = props[keyProp];

  if (!isNonEmptyString(key)) {
    return undefined;
  }

  const translated = translate(key);
  if (isNonEmptyString(translated) && translated !== key) {
    return translated;
  }

  if (hasOwnProp(props, targetProp)) {
    return undefined;
  }

  return key;
}

export function createStudioLocalizationNodePropsResolver(
  translate: (key: string) => string,
): RuntimeNodePropsResolver {
  return ({ props }: RuntimeResolveNodePropsArgs) => {
    let resolvedProps: Record<string, unknown> | undefined;

    for (const [keyProp, targetProp] of STUDIO_LOCALIZED_PROP_PAIRS) {
      const localizedValue = resolveLocalizedPropValue({
        props,
        keyProp,
        targetProp,
        translate,
      });

      if (localizedValue === undefined) {
        continue;
      }

      const nextProps = resolvedProps ?? { ...props };
      nextProps[targetProp] = localizedValue;
      resolvedProps = nextProps;
    }

    return resolvedProps ?? props;
  };
}

export function getSetLanguageLocale(action: unknown): string | undefined {
  if (typeof action !== 'object' || action === null || Array.isArray(action)) {
    return undefined;
  }

  const record = action as Record<string, unknown>;
  if (record.type !== 'setLanguage') {
    return undefined;
  }

  const { payload } = record;
  if (typeof payload !== 'object' || payload === null || Array.isArray(payload)) {
    return undefined;
  }

  const { locale } = payload as Record<string, unknown>;
  return typeof locale === 'string' && locale.length > 0 ? locale : undefined;
}

export function createStudioLocalizationActionHandlers(
  setActiveLocale: (locale: string) => void,
): StudioRuntimeActionHandlers {
  return {
    setLanguage: ({ action }: StudioRuntimeActionHandlerContext) => {
      const locale = getSetLanguageLocale(action);
      if (locale !== undefined) {
        setActiveLocale(locale);
      }
    },
  };
}
