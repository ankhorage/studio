from pathlib import Path
import json
import re


def replace_once(path: str, old: str, new: str) -> None:
    file_path = Path(path)
    text = file_path.read_text()
    if old not in text:
        raise SystemExit(f"missing patch anchor in {path}: {old[:100]!r}")
    file_path.write_text(text.replace(old, new, 1))


package_path = Path("package.json")
package = json.loads(package_path.read_text())
package["dependencies"]["@ankhorage/expo-runtime"] = "^2.1.0"
package["dependencies"]["@ankhorage/supabase-storage"] = "^0.2.0"
package_path.write_text(json.dumps(package, indent=2) + "\n")

replace_once(
    "src/index.ts",
    "import type { StudioAuthSettings, StudioAuthSettingsMutation } from './authSettings';\n",
    "import type { StudioAuthSettings, StudioAuthSettingsMutation } from './authSettings';\n"
    "import type { StudioMediaIngestResult, StudioMediaPickerSource } from './mediaPickerAuthoring';\n",
)
replace_once(
    "src/index.ts",
    "export * from './mediaAuthoringModel';\n",
    "export * from './mediaAuthoringModel';\nexport * from './mediaPickerAuthoring';\n",
)
replace_once(
    "src/index.ts",
    "  'removeStudioMediaAsset',\n",
    "  'removeStudioMediaAsset',\n  'StudioMediaPickerAdapter',\n",
)
replace_once(
    "src/index.ts",
    "  removeMediaAsset: (mediaId: string) => boolean;\n",
    "  removeMediaAsset: (mediaId: string) => boolean;\n"
    "  mediaPickerAvailable: boolean;\n"
    "  ingestMediaFromPicker: (source: StudioMediaPickerSource) => Promise<StudioMediaIngestResult>;\n",
)

replace_once(
    "src/core/StudioProvider.ts",
    "import { removeStudioMediaAsset, upsertStudioMediaAsset } from '../mediaAuthoringModel';\n",
    "import {\n"
    "  createStudioMediaAssetId,\n"
    "  removeStudioMediaAsset,\n"
    "  upsertStudioMediaAsset,\n"
    "} from '../mediaAuthoringModel';\n"
    "import type {\n"
    "  StudioMediaIngestResult,\n"
    "  StudioMediaPickerAdapter,\n"
    "  StudioMediaPickerSource,\n"
    "} from '../mediaPickerAuthoring';\n",
)
replace_once(
    "src/core/StudioProvider.ts",
    "import { resolveScreenIdForPathname } from '../routeUtils';\n",
    "import { resolveScreenIdForPathname } from '../routeUtils';\n"
    "import { ingestStudioMediaSelection } from './mediaAuthoringHostClient';\n",
)
replace_once(
    "src/core/StudioProvider.ts",
    "  componentMeta: StudioComponentMetaRegistry;\n}",
    "  componentMeta: StudioComponentMetaRegistry;\n  mediaPicker?: StudioMediaPickerAdapter;\n}",
)
replace_once(
    "src/core/StudioProvider.ts",
    "  componentMeta,\n}: StudioProviderProps) => {",
    "  componentMeta,\n  mediaPicker,\n}: StudioProviderProps) => {",
)
ingest_block = (
    "\n  const ingestMediaFromPicker = useCallback(\n"
    "    async (source: StudioMediaPickerSource): Promise<StudioMediaIngestResult> => {\n"
    "      if (!mediaPicker) return { ok: false, reason: 'Media picker unavailable.' };\n"
    "      const picked = await mediaPicker.pick({ source });\n"
    "      if (!picked.ok) return picked;\n"
    "      const current = manifestRef.current;\n"
    "      if (!current) return { ok: false, reason: 'Manifest unavailable.' };\n"
    "      const assetId = createStudioMediaAssetId(picked.selection.name, current.media?.assets);\n"
    "      const ingested = await ingestStudioMediaSelection({\n"
    "        projectId,\n"
    "        assetId,\n"
    "        selection: picked.selection,\n"
    "      });\n"
    "      if (!ingested.ok) return ingested;\n"
    "      upsertMediaAsset(ingested.asset);\n"
    "      return ingested;\n"
    "    },\n"
    "    [mediaPicker, projectId, upsertMediaAsset],\n"
    "  );\n"
)
replace_once(
    "src/core/StudioProvider.ts",
    "\n  const updateTheme = useCallback(\n",
    ingest_block + "\n  const updateTheme = useCallback(\n",
)
replace_once(
    "src/core/StudioProvider.ts",
    "      removeMediaAsset,\n",
    "      removeMediaAsset,\n"
    "      mediaPickerAvailable: mediaPicker !== undefined,\n"
    "      ingestMediaFromPicker,\n",
)
replace_once(
    "src/core/StudioProvider.ts",
    "      removeMediaAsset,\n      updateAuthSettings,\n",
    "      removeMediaAsset,\n"
    "      mediaPicker,\n"
    "      ingestMediaFromPicker,\n"
    "      updateAuthSettings,\n",
)

server_path = Path("src/host/http/server.ts")
server = server_path.read_text()
server = server.replace("  readProjectInfrastructureEnvironment,\n", "", 1)
server = server.replace(
    "import { registerProjectModuleRoutes } from './moduleRoutes';\n",
    "import { registerProjectMediaRoutes } from './mediaRoutes';\n"
    "import { registerProjectModuleRoutes } from './moduleRoutes';\n",
    1,
)
server = server.replace(
    "  // --- PROJECT ROUTES ---\n",
    "  registerProjectMediaRoutes(fastify, { projectManager, workspaceRoot: projectRoot });\n\n"
    "  // --- PROJECT ROUTES ---\n",
    1,
)
legacy_route = re.compile(
    r"\n  // GET project-scoped Supabase public credentials for Studio uploads\n"
    r".*?\n  // PUT \(Save\) Manifest",
    re.S,
)
server, count = legacy_route.subn("\n  // PUT (Save) Manifest", server, count=1)
if count != 1:
    raise SystemExit("failed to remove legacy supabase-public route")
server_path.write_text(server)

replace_once(
    "src/host/layout/templates/rootLayout.ts",
    "    ...(includeStudio\n"
    "      ? [\n"
    "          {\n"
    "            source: '@ankhorage/studio/runtime',",
    "    ...(includeStudio\n"
    "      ? [\n"
    "          {\n"
    "            source: '@ankhorage/expo-runtime/media-picker',\n"
    "            namedImports: [{ imported: 'createExpoMediaPickerAdapter' }],\n"
    "          },\n"
    "        ]\n"
    "      : []),\n"
    "    ...(includeStudio\n"
    "      ? [\n"
    "          {\n"
    "            source: '@ankhorage/studio/runtime',",
)
replace_once(
    "src/host/layout/templates/rootLayout.ts",
    "    includeStudio ? appHeaderHelpers.trim() : '',\n"
    "    innerNavigation.declarations.trim(),",
    "    includeStudio ? appHeaderHelpers.trim() : '',\n"
    "    includeStudio ? 'const studioMediaPicker = createExpoMediaPickerAdapter();' : '',\n"
    "    innerNavigation.declarations.trim(),",
)
replace_once(
    "src/host/layout/templates/rootLayout.ts",
    "        componentMeta={ZORA_COMPONENT_META}\n      >",
    "        componentMeta={ZORA_COMPONENT_META}\n"
    "        mediaPicker={studioMediaPicker}\n"
    "      >",
)

replace_once(
    "src/host/orchestrator/templates.ts",
    "const EXPO_SECURE_STORE_VERSION = '~15.0.8';\n",
    "const EXPO_RUNTIME_VERSION = '^2.1.0';\n"
    "const EXPO_DOCUMENT_PICKER_VERSION = '~14.0.8';\n"
    "const EXPO_FILE_SYSTEM_VERSION = '~19.0.23';\n"
    "const EXPO_IMAGE_PICKER_VERSION = '~17.0.11';\n"
    "const EXPO_SECURE_STORE_VERSION = '~15.0.8';\n",
)
replace_once(
    "src/host/orchestrator/templates.ts",
    "            '@expo/vector-icons': '^15.0.3',\n"
    "            '@react-native-picker/picker': '2.11.1',",
    "            '@ankhorage/expo-runtime': EXPO_RUNTIME_VERSION,\n"
    "            '@expo/vector-icons': '^15.0.3',\n"
    "            '@react-native-picker/picker': '2.11.1',\n"
    "            'expo-document-picker': EXPO_DOCUMENT_PICKER_VERSION,\n"
    "            'expo-file-system': EXPO_FILE_SYSTEM_VERSION,\n"
    "            'expo-image-picker': EXPO_IMAGE_PICKER_VERSION,",
)
