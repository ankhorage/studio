import { describe, expect, test } from 'bun:test';

import { projectGeneratedRoute } from './projectGeneratedRoute';

describe('projectGeneratedRoute', () => {
  test('projects nested public paths, route groups, index, dynamic, catch-all, and auth partition routes', () => {
    const app = projectGeneratedRoute({
      parentModulePath: 'src/app/(app)',
      parentPublicPath: '/',
      route: { name: '(training)', navigator: { type: 'stack', routes: [] } },
    });
    const index = projectGeneratedRoute({
      parentModulePath: app.modulePath,
      parentPublicPath: app.publicPath,
      route: { name: 'index', screenId: 'home' },
    });
    const dynamic = projectGeneratedRoute({
      parentModulePath: app.modulePath,
      parentPublicPath: app.publicPath,
      route: { name: '[id]', path: 'sessions/[id]', screenId: 'session' },
    });
    const catchAll = projectGeneratedRoute({
      parentModulePath: app.modulePath,
      parentPublicPath: app.publicPath,
      route: { name: '[...segments]', path: 'docs/[...segments]', screenId: 'docs' },
    });
    const auth = projectGeneratedRoute({
      parentModulePath: 'src/app/(auth)',
      parentPublicPath: '/',
      route: { name: 'sign-in', path: '/sign-in', screenId: 'sign-in' },
    });

    expect(app).toEqual({
      modulePath: 'src/app/(app)/(training)',
      navigatorPath: '/',
      publicPath: '/',
    });
    expect(index).toEqual({
      modulePath: 'src/app/(app)/(training)/index',
      navigatorPath: '/',
      publicPath: '/',
    });
    expect(dynamic).toEqual({
      modulePath: 'src/app/(app)/(training)/sessions/[id]',
      navigatorPath: '/sessions/:id',
      publicPath: '/sessions/[id]',
    });
    expect(catchAll).toEqual({
      modulePath: 'src/app/(app)/(training)/docs/[...segments]',
      navigatorPath: '/docs/:segments',
      publicPath: '/docs/[...segments]',
    });
    expect(auth).toEqual({
      modulePath: 'src/app/(auth)/sign-in',
      navigatorPath: '/sign-in',
      publicPath: '/sign-in',
    });
  });
});
