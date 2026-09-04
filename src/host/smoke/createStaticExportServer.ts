import path from 'node:path';

/***
 * Serve a generated static export from an ephemeral loopback Bun server for acceptance tests.
 * @utility @ankhorage/utility/bun/http
 * @todo Move the consuming smoke harness out of src/host into test/smoke.
 */
export function createStaticExportServer(
  projectRoot: string,
  outputDirectory = 'dist',
): ReturnType<typeof Bun.serve> {
  const outputRoot = path.resolve(projectRoot, outputDirectory);
  return Bun.serve({
    hostname: '127.0.0.1',
    port: 0,
    /*** Resolve a request to the first safe static-export file candidate within the output root. */
    async fetch(request) {
      const relativePaths = resolveStaticExportPaths(new URL(request.url).pathname);
      for (const relativePath of relativePaths) {
        const targetPath = path.resolve(outputRoot, relativePath);
        if (!targetPath.startsWith(`${outputRoot}${path.sep}`) && targetPath !== outputRoot) {
          return new Response('Not found', { status: 404 });
        }
        const file = Bun.file(targetPath);
        if (await file.exists()) return new Response(file);
      }
      return new Response('Not found', { status: 404 });
    },
  });
}

/***
 * Resolve static-export URL path candidates using direct files, .html fallback, and directory index fallback.
 * @utility @ankhorage/utility/http
 */
function resolveStaticExportPaths(pathname: string): string[] {
  if (pathname === '/') return ['index.html'];
  const decoded = decodeURIComponent(pathname).replace(/^\/+|\/+$/gu, '');
  if (path.extname(decoded)) return [decoded];
  return [`${decoded}.html`, path.join(decoded, 'index.html')];
}
