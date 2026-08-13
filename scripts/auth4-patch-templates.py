from pathlib import Path
import re

path = Path('src/host/orchestrator/templates.ts')
text = path.read_text()
text = text.replace(
    "import type { SplashScreenSpec } from '@ankhorage/contracts';\n",
    "import type { SplashScreenSpec } from '@ankhorage/contracts';\nimport type { AppDeployAndroidTargetConfig, AppDeployIosTargetConfig, AppDeployTargets } from '@ankhorage/contracts/deploy';\n",
    1,
)
text = re.sub(
    r"const RESERVED_NATIVE_IDENTIFIER_SEGMENTS = new Set\([\s\S]*?\n\);\n\nfunction serializeStringLiteral",
    'function serializeStringLiteral',
    text,
    count=1,
)
text = re.sub(
    r"function createNativeIdentifierSegment\([\s\S]*?\nexport function getMetroConfigJs",
    """function serializeAndroidConfig(args: { target: AppDeployAndroidTargetConfig; runtimePlan?: ExpoRuntimePlan }): string {\n  const permissions = resolveExpoRuntimeNativeOutput(args.runtimePlan).androidPermissions;\n  const extraLines = permissions.length > 0 ? `\\n    permissions: ${serializeJsValue(permissions, 2)},` : '';\n  const schemeLine = args.target.scheme ? `\\n    scheme: ${serializeStringLiteral(args.target.scheme)},` : '';\n  return `{\n    ...config.android,${extraLines}\n    package: ${serializeStringLiteral(args.target.package)},${schemeLine}\n  }`;\n}\n\nfunction serializeIosConfig(target: AppDeployIosTargetConfig): string {\n  const schemeLine = target.scheme ? `\\n    scheme: ${serializeStringLiteral(target.scheme)},` : '';\n  return `{\n    ...config.ios,\n    bundleIdentifier: ${serializeStringLiteral(target.bundleIdentifier)},${schemeLine}\n  }`;\n}\n\nfunction serializeTargetSections(args: { targets: AppDeployTargets; runtimePlan?: ExpoRuntimePlan }): string {\n  const sections: string[] = [];\n  if (args.targets.android?.enabled) sections.push(`  android: ${serializeAndroidConfig({ target: args.targets.android, runtimePlan: args.runtimePlan })},`);\n  if (args.targets.ios?.enabled) sections.push(`  ios: ${serializeIosConfig(args.targets.ios)},`);\n  if (args.targets.web?.enabled) sections.push(`  web: {\\n    ...config.web,\\n    output: 'static',\\n    favicon: './assets/favicon.png',\\n  },`);\n  return sections.length > 0 ? `\\n${sections.join('\\n')}` : '';\n}\n\nexport function getAppConfigTs({ name, slug, targets, splashScreen = null, runtimePlan }: { name: string; slug: string; targets: AppDeployTargets; splashScreen?: SplashScreenSpec | null; runtimePlan?: ExpoRuntimePlan }) {\n  const targetSections = serializeTargetSections({ targets, runtimePlan });\n  return `import type { ConfigContext, ExpoConfig } from 'expo/config';\\n\\nexport default ({ config }: ConfigContext): ExpoConfig => {\\n  const baseConfig = { ...config };\\n  delete baseConfig.scheme;\\n  delete baseConfig.android;\\n  delete baseConfig.ios;\\n  delete baseConfig.web;\\n\\n  return {\\n    ...baseConfig,\\n    name: ${serializeStringLiteral(name)},\\n    slug: ${serializeStringLiteral(slug)},\\n    plugins: ${serializePluginsWithRuntimePlan({ splashScreen, runtimePlan })},${targetSections}\\n  };\\n};\\n`;\n}\n\nexport function getMetroConfigJs""",
    text,
    count=1,
)
text = text.replace(
    "const EXPO_WEB_BROWSER_VERSION = '~15.0.11';\n",
    "const EXPO_WEB_BROWSER_VERSION = '~15.0.11';\nconst LEGACY_WEB_ONLY_TARGETS = { web: { enabled: true } } as const satisfies AppDeployTargets;\n",
    1,
)
text = text.replace(
    "  storageProvider?: GeneratedStorageProvider;\n  runtimePlan?: ExpoRuntimePlan;\n}) {\n",
    "  storageProvider?: GeneratedStorageProvider;\n  runtimePlan?: ExpoRuntimePlan;\n  targets?: AppDeployTargets;\n}) {\n",
    1,
)
text = text.replace(
    "    storageProvider = null,\n    runtimePlan,\n  } = args;\n",
    "    storageProvider = null,\n    runtimePlan,\n    targets = LEGACY_WEB_ONLY_TARGETS,\n  } = args;\n",
    1,
)
text = text.replace(
    "      android: 'expo run:android',\n      ios: 'expo run:ios',\n      web: 'expo start --web',\n",
    "      ...(targets.android?.enabled ? { android: 'expo run:android' } : {}),\n      ...(targets.ios?.enabled ? { ios: 'expo run:ios' } : {}),\n      ...(targets.web?.enabled ? { web: 'expo start --web' } : {}),\n",
    1,
)
path.write_text(text)
