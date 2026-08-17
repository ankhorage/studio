import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';

import type { DataSourceDiagnostic, UiNode } from '@ankhorage/contracts';
import type { EndpointTestFetch, EndpointTestFetchInit } from '@ankhorage/data-sources';
import { createRuntimeApiOperationExecutor, resolveRuntimeBindingValue } from '@ankhorage/runtime';
import { expect, test } from 'bun:test';

import { StudioExternalApiService } from './apis/studioExternalApiService';
import { ProjectManager } from './orchestrator/projectManager';

const NUTRITION_API_BASE_URL = 'https://api.ankhorage.com/v1/nutrition';
const PRODUCTS_REQUEST_URL = `${NUTRITION_API_BASE_URL}/products?limit=50&offset=0`;
const CATALOG_SCREEN_ID = 'food_drink-nutrition-catalog-scan-catalog';
const PRODUCTS_GRID_ID = 'food_drink-nutrition-catalog-scan-products-grid';

type OperationRepeatSource = Extract<
  NonNullable<NonNullable<UiNode['repeat']>['source']>,
  { readonly kind: 'operation' }
>;

interface RecordedRequest {
  readonly url: string;
  readonly init: EndpointTestFetchInit;
}

test('generated Nutrition app executes canonical product bindings over external HTTP', async () => {
  const workspaceRoot = await createWorkspaceRoot();
  const previousSupabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL;
  process.env.EXPO_PUBLIC_SUPABASE_URL = 'http://127.0.0.1:54321';

  try {
    const manager = new ProjectManager(workspaceRoot);
    const created = await manager.createProject(
      'Nutrition API E2E',
      { category: 'food_drink', templateId: 'nutrition-catalog-scan' },
      undefined,
      { includeStudio: true },
    );
    const manifest = await manager.getProjectManifest(created.id);
    const source = assertCanonicalNutritionManifest(manifest);
    await assertGeneratedRuntimeSource(created.path);
    const requests: RecordedRequest[] = [];
    const endpointFetch = createRecordingFetch(requests);

    await executeGeneratedRuntimeBinding(manifest.infra.apis, source, endpointFetch);
    await executeStudioApiOperation(manager, created.id, endpointFetch);
    assertExternalProductRequests(requests);
  } finally {
    restoreSupabaseUrl(previousSupabaseUrl);
    await rm(workspaceRoot, { recursive: true, force: true });
  }
});

async function createWorkspaceRoot(): Promise<string> {
  const workspaceRoot = await mkdtemp(path.join(tmpdir(), 'studio-nutrition-api-e2e-'));
  await mkdir(path.join(workspaceRoot, 'apps', 'studio'), { recursive: true });
  await writeFile(
    path.join(workspaceRoot, 'package.json'),
    JSON.stringify({ name: '@ankhorage/studio', private: true, workspaces: ['apps/*'] }),
  );
  return workspaceRoot;
}

function assertCanonicalNutritionManifest(
  manifest: Awaited<ReturnType<ProjectManager['getProjectManifest']>>,
): OperationRepeatSource {
  expect(manifest.infra.apis).toHaveLength(1);
  expect(manifest.infra.apis?.at(0)).toMatchObject({
    id: 'nutrition',
    origin: 'external',
    protocol: 'rest',
    baseUrl: NUTRITION_API_BASE_URL,
  });
  const serialized = JSON.stringify(manifest);
  expect(serialized).not.toContain('generatedApis');
  expect(serialized).not.toContain('nutrition-products');
  expect(serialized).not.toContain('nutrition_products');
  expect(serialized).not.toContain('dataSourceId');

  const screen = Object.values(manifest.screens).find(({ id }) => id === CATALOG_SCREEN_ID);
  if (!screen) throw new Error('Generated Nutrition manifest is missing the catalog screen.');
  const grid = findNode(screen.root, PRODUCTS_GRID_ID);
  const source = grid?.repeat?.source;
  if (source?.kind !== 'operation') {
    throw new Error('Generated Nutrition products grid is missing its canonical operation source.');
  }
  expect(source.operation).toEqual({
    apiId: 'nutrition',
    endpointId: 'products',
    operationId: 'products.list',
  });
  return source;
}

async function assertGeneratedRuntimeSource(projectPath: string): Promise<void> {
  const rootLayout = await readFile(path.join(projectPath, 'src', 'app', '_layout.tsx'), 'utf8');
  expect(rootLayout).toContain('createRuntimeApiOperationExecutor');
  expect(rootLayout).toContain('fetch: runtimeApiFetch');
  expect(rootLayout).not.toContain('EXPO_PUBLIC_SUPABASE_URL');
  expect(rootLayout).not.toContain('/rest/v1/');
  expect(rootLayout).not.toContain('nutrition_products');
  expect(rootLayout).not.toContain('@ankhorage/supabase-db');
}

async function executeGeneratedRuntimeBinding(
  apis: Awaited<ReturnType<ProjectManager['getProjectManifest']>>['infra']['apis'],
  source: OperationRepeatSource,
  endpointFetch: EndpointTestFetch,
): Promise<void> {
  const diagnostics: DataSourceDiagnostic[] = [];
  const value = await resolveRuntimeBindingValue(
    { source },
    { apis, executeOperation: createRuntimeApiOperationExecutor({ fetch: endpointFetch }) },
    diagnostics,
  );
  expect(diagnostics).toEqual([]);
  expect(value).toEqual([
    { id: 'product-1', barcode: '7612345678901', name: 'Acceptance Product' },
  ]);
}

async function executeStudioApiOperation(
  manager: ProjectManager,
  projectId: string,
  endpointFetch: EndpointTestFetch,
): Promise<void> {
  const service = new StudioExternalApiService({ projectManager: manager, endpointFetch });
  const result = await service.testOperation(projectId, {
    apiId: 'nutrition',
    endpointId: 'products',
    operationId: 'products.list',
  });
  expect(result.ok).toBe(true);
}

function createRecordingFetch(requests: RecordedRequest[]): EndpointTestFetch {
  return (url, init) => {
    requests.push({ url, init });
    return Promise.resolve({
      status: 200,
      headers: { 'content-type': 'application/json' },
      text: () =>
        Promise.resolve(
          JSON.stringify({
            products: [
              { id: 'product-1', barcode: '7612345678901', name: 'Acceptance Product' },
            ],
          }),
        ),
    });
  };
}

function assertExternalProductRequests(requests: readonly RecordedRequest[]): void {
  expect(requests).toHaveLength(2);
  for (const request of requests) {
    expect(request.url).toBe(PRODUCTS_REQUEST_URL);
    expect(request.init.method).toBe('GET');
    expect(request.url).not.toContain('127.0.0.1');
    expect(request.url).not.toContain('/rest/v1/');
    expect(request.url).not.toContain('nutrition_products');
  }
}

function findNode(root: UiNode, nodeId: string): UiNode | undefined {
  const pending = [root];
  for (const node of pending) {
    if (node.id === nodeId) return node;
    pending.push(...(node.children ?? []));
  }
  return undefined;
}

function restoreSupabaseUrl(previous: string | undefined): void {
  if (previous === undefined) {
    delete process.env.EXPO_PUBLIC_SUPABASE_URL;
    return;
  }
  process.env.EXPO_PUBLIC_SUPABASE_URL = previous;
}
