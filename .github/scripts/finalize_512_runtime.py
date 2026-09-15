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

# App authoring/project synchronization must not implicitly execute Infra generation.
# Infrastructure lifecycle is explicit through regenerateInfrastructure / upInfrastructure.
replace(
    'src/host/orchestrator/projectManager.ts',
    "    await this.dependencies.reconcileProjectPackageRootAsync(projectPath);\n    await this.dependencies.infraLifecycle.generateAsync({\n      projectId: slug,\n      projectPath,\n      manifest,\n    });\n    if (onProjectCreated) await onProjectCreated(slug);",
    "    await this.dependencies.reconcileProjectPackageRootAsync(projectPath);\n    if (onProjectCreated) await onProjectCreated(slug);",
)
replace(
    'src/host/orchestrator/projectManager.ts',
    "/*** Persist a project manifest, optionally regenerate current scaffold/router ownership, and synchronize infrastructure. */",
    "/*** Persist a project manifest and optionally regenerate current scaffold/router ownership. */",
)
replace(
    'src/host/orchestrator/projectManager.ts',
    "\n    await this.dependencies.infraLifecycle.generateAsync({\n      projectId,\n      projectPath,\n      manifest: updated,\n    });\n    return { success: true };",
    "\n    return { success: true };",
)
replace(
    'src/host/orchestrator/projectManager.ts',
    "/*** Regenerate current project scaffold/runtime files from the persisted manifest and synchronize infrastructure without changing manifest state. */",
    "/*** Regenerate current project scaffold/runtime files from the persisted manifest without changing manifest or infrastructure state. */",
)
replace(
    'src/host/orchestrator/projectManager.ts',
    "    await this.dependencies.reconcileProjectPackageRootAsync(projectPath);\n    await this.dependencies.infraLifecycle.generateAsync({ projectId, projectPath, manifest });\n    return { success: true };",
    "    await this.dependencies.reconcileProjectPackageRootAsync(projectPath);\n    return { success: true };",
)

# Remove the ProjectManager compatibility alias; ModuleManager keeps its own canonical sync use case.
replace(
    'src/host/orchestrator/projectManager.ts',
    "        'rebuildRootLayout',\n        'syncProject',\n      ],",
    "        'rebuildRootLayout',\n      ],",
)
replace(
    'src/host/orchestrator/projectManager.ts',
    "\n  /***\n   * Delegate project synchronization to syncProjectRuntime.\n   * @todo Remove this compatibility alias and keep one canonical project synchronization operation.\n   */\n  async syncProject(args: {\n    projectId: string;\n    mutations: LayoutMutation[];\n    includeStudio?: boolean;\n  }) {\n    return this.syncProjectRuntime(args);\n  }\n",
    "",
)
replace(
    'src/host/orchestrator/moduleManager.ts',
    "    await this.projectManager.syncProject({\n      projectId,\n      mutations: await this.resolveLayoutMutations(projectId),\n    });",
    "    await this.projectManager.syncProjectRuntime({\n      projectId,\n      mutations: await this.resolveLayoutMutations(projectId),\n    });",
)
replace(
    'src/host/orchestrator/moduleManager.ts',
    "    return this.projectManager.syncProject({\n      projectId,\n      mutations: await this.resolveLayoutMutations(projectId),\n      includeStudio,\n    });",
    "    return this.projectManager.syncProjectRuntime({\n      projectId,\n      mutations: await this.resolveLayoutMutations(projectId),\n      includeStudio,\n    });",
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
