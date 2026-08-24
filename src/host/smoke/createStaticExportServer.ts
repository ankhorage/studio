import path from 'node:path';

export function createStaticExportServer(projectRoot: string): ReturnType<typeof Bun.serve> {
  const outputRoot = path.resolve(projectRoot, 'dist');
  return Bun.serve({
    hostname: '127.0.0.1',
    port: 0,
    async fetch(request) {
      const relativePath = resolveStaticExportPath(new URL(request.url).pathname);
      const targetPath = path.resolve(outputRoot, relativePath);
      if (!targetPath.startsWith(`${outputRoot}${path.sep}`) && targetPath !== outputRoot) {
        return new Response('Not found', { status: 404 });
      }
      const file = Bun.file(targetPath);
      if (!(await file.exists())) return new Response('Not found', { status: 404 });
      return new Response(file);
    },
  });
}

function resolveStaticExportPath(pathname: string): string {
  if (pathname === '/') return 'index.html';
  const decoded = decodeURIComponent(pathname).replace(/^\/+|\/+$/gu, '');
  if (path.extname(decoded)) return decoded;
  return `${decoded}.html`;
}
