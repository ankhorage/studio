import type { NavigatorNode, RouteDefinition } from '@ankhorage/contracts';

import {
  type StudioAdminRouteDefinition,
  STUDIO_ADMIN_ROUTE_REGISTRY,
} from '../../../studioAdminRouteModel';

const STUDIO_ADMIN_ROOT_PATH = '/ankh';

/*** Build the generated Studio administration Drawer/Stack topology from the canonical route registry. */
export function createStudioAdminNavigator(): NavigatorNode {
  return {
    type: 'drawer',
    options: {
      drawerPosition: 'left',
      drawerType: 'front',
      swipeEnabled: true,
      headerShown: true,
    },
    routes: STUDIO_ADMIN_ROUTE_REGISTRY.filter((route) => !route.parentId).map((route) =>
      createRootRoute(route),
    ),
  };
}

/*** Project one top-level Admin route into the Drawer while preserving nested detail routes as Stacks. */
function createRootRoute(definition: StudioAdminRouteDefinition): RouteDefinition {
  const segments = resolveRelativeRouteSegments(definition.path, STUDIO_ADMIN_ROOT_PATH);
  if (segments.length === 0) {
    return createLeafRoute(definition, 'index', true);
  }

  return createRouteChain({
    definition,
    segments,
    children: resolveChildDefinitions(definition),
    primaryNavigation: true,
  });
}

interface CreateRouteChainInput {
  readonly definition: StudioAdminRouteDefinition;
  readonly segments: readonly string[];
  readonly children: readonly StudioAdminRouteDefinition[];
  readonly primaryNavigation: boolean;
}

/*** Build filesystem-shaped Navigator route nesting for one canonical route definition. */
function createRouteChain(input: CreateRouteChainInput): RouteDefinition {
  const [segment, ...remainingSegments] = input.segments;
  if (!segment) {
    throw new Error(`Studio Admin route '${input.definition.id}' has no Navigator segment.`);
  }

  const presentation = createRoutePresentation(
    input.definition,
    input.primaryNavigation,
    input.segments,
  );
  if (remainingSegments.length > 0) {
    return {
      name: segment,
      ...presentation,
      navigator: {
        type: 'stack',
        routes: [
          createRouteChain({
            ...input,
            segments: remainingSegments,
            primaryNavigation: false,
          }),
        ],
      },
    };
  }

  if (input.children.length === 0) {
    return {
      name: segment,
      ...presentation,
    };
  }

  return {
    name: segment,
    ...presentation,
    navigator: {
      type: 'stack',
      initialRouteName: 'index',
      routes: [
        createLeafRoute(input.definition, 'index', false),
        ...input.children.map((child) =>
          createRouteChain({
            definition: child,
            segments: resolveRelativeRouteSegments(child.path, input.definition.path),
            children: resolveChildDefinitions(child),
            primaryNavigation: false,
          }),
        ),
      ],
    },
  };
}

/*** Create one externally-owned Admin screen route for Navigator-generated layout composition. */
function createLeafRoute(
  definition: StudioAdminRouteDefinition,
  name: string,
  primaryNavigation: boolean,
): RouteDefinition {
  return {
    name,
    ...createRoutePresentation(definition, primaryNavigation, [name]),
  };
}

/*** Preserve route labels/icons while hiding parameterized top-level destinations from static primary navigation. */
function createRoutePresentation(
  definition: StudioAdminRouteDefinition,
  primaryNavigation: boolean,
  segments: readonly string[],
): Pick<RouteDefinition, 'icon' | 'label' | 'showInPrimaryNavigation'> {
  const hasDynamicSegment = segments.some((segment) => /^\[.+\]$/u.test(segment));
  return {
    label: definition.label,
    icon: { name: definition.icon },
    showInPrimaryNavigation:
      !primaryNavigation || definition.showInNavigation === false || hasDynamicSegment
        ? false
        : true,
  };
}

/*** Read direct children from the canonical route registry without duplicating Admin route ownership. */
function resolveChildDefinitions(
  definition: StudioAdminRouteDefinition,
): readonly StudioAdminRouteDefinition[] {
  return STUDIO_ADMIN_ROUTE_REGISTRY.filter((route) => route.parentId === definition.id);
}

/*** Resolve a child path into Expo Router segments relative to its canonical Admin parent path. */
function resolveRelativeRouteSegments(pathname: string, parentPath: string): readonly string[] {
  const relativePath =
    pathname === parentPath
      ? ''
      : pathname.startsWith(`${parentPath}/`)
        ? pathname.slice(parentPath.length + 1)
        : null;
  if (relativePath === null) {
    throw new Error(
      `Studio Admin route '${pathname}' is not nested below canonical parent '${parentPath}'.`,
    );
  }

  return relativePath
    .split('/')
    .filter(Boolean)
    .map((segment) => (segment.startsWith(':') ? `[${segment.slice(1)}]` : segment));
}
