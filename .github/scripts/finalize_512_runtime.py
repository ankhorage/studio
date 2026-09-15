from pathlib import Path


def replace(path: str, old: str, new: str) -> None:
    target = Path(path)
    source = target.read_text()
    if old not in source:
        raise SystemExit(f"missing replacement in {path}: {old[:140]!r}")
    target.write_text(source.replace(old, new))


# Complete project-specific local Infra networking at Studio's canonical persistence boundary.
replace(
    'src/host/orchestrator/projectManager.ts',
    "import { createStudioProjectInfraLifecycle } from '../../features/infrastructure/composition/createStudioProjectInfraLifecycle';",
    "import { initializeProjectLocalInfraNetworking } from '../../features/infrastructure/application/use-cases/initializeProjectLocalInfraNetworking';\nimport { createStudioProjectInfraLifecycle } from '../../features/infrastructure/composition/createStudioProjectInfraLifecycle';",
)
replace(
    'src/host/orchestrator/projectManager.ts',
    "    const { category } = materializedTemplate.metadata;\n    const deploy = materializedTemplate.deploy ?? createDefaultAppDeployManifest(slug);\n    const scaffoldManifest = applySystemTemplates({ ...materializedTemplate, deploy });",
    "    const initializedTemplate = initializeProjectLocalInfraNetworking(materializedTemplate, slug);\n    const { category } = initializedTemplate.metadata;\n    const deploy = initializedTemplate.deploy ?? createDefaultAppDeployManifest(slug);\n    const scaffoldManifest = applySystemTemplates({ ...initializedTemplate, deploy });",
)
replace(
    'src/host/orchestrator/projectManager.ts',
    "      materializedTemplate,\n      name,",
    "      initializedTemplate,\n      name,",
)
replace(
    'src/host/orchestrator/projectManager.ts',
    "    const normalizedManifest = applySystemTemplates(args.manifest);\n    return this.store.writeManifest(args.projectId, normalizedManifest);",
    "    const normalizedManifest = initializeProjectLocalInfraNetworking(\n      applySystemTemplates(args.manifest),\n      args.projectId,\n    );\n    return this.store.writeManifest(args.projectId, normalizedManifest);",
)

# Current environment-aware secret-usage path.
replace(
    'src/host/secrets/projectSecretService.test.ts',
    "path: 'infra.auth.oauth.providers[google].credentialsRef'",
    "path: 'infra.environments.local.auth.oauth.providers[google].credentialsRef'",
)

# Auth settings reads are environment-specific after Contracts 19.
replace(
    'src/ui/admin/pages/AuthAdminPage.test.ts',
    "expect(source).toContain('readStudioAuthSettings(canonicalManifestRef.current)');",
    "expect(source).toContain('readStudioAuthSettings(canonicalManifestRef.current, environment)');",
)

# Trusted OAuth resolution intentionally re-reads canonical manifest state through its owner boundary.
replace(
    'src/host/orchestrator/studioInfraUp.test.ts',
    "expect(calls).toEqual(['regenerate:project-one', 'manifest:project-one', 'up:project-one']);",
    "expect(calls).toEqual([\n      'regenerate:project-one',\n      'manifest:project-one',\n      'manifest:project-one',\n      'up:project-one',\n    ]);",
)
