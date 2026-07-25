# Studio Selection Focused Boundary Validation

## Result

Status: **NO-GO**

The focused outer-boundary implementation pass produced an executed Expo web semantic failure after
the generated web smoke harness repair from PR #165 was present on `origin/main`.

No implementation PR should be opened from this evidence, and this does not fix issue #156.

## Scope Attempted

The attempted production change was limited to:

```text
src/host/layout/templates/rootLayout.ts
```

The attempted implementation removed Studio's cloned rendered-component selection props and kept
selection on the Studio-owned outer boundary. The attempted generated boundary was:

- component: React Native `Pressable`
- props: `testID={\`studio-runtime-node-\${props.nodeId}\`}`, `onPress`, `style`
- handler: `event.stopPropagation(); selectNode(props.nodeId ?? null);`
- style: `{ display: 'contents' as const }`
- no authored-component prop mutation
- no `cloneElement` / `isValidElement`
- no injected selected, hover, or focus styles
- no `accessibilityRole`, `accessibilityLabel`, or `accessibilityState`
- no hover or focus handlers
- `disableActions: !previewMode`
- `wrapNode: previewMode ? undefined : wrapStudioRuntimeNode`

Those attempted implementation and smoke-test edits were not committed because the required web
validation did not pass. This commit records evidence only.

Switching between Edit and Preview would intentionally be allowed to remount authored Runtime nodes
under this shape because Edit has a Studio wrapper and Preview uses `wrapNode: undefined`.

## Baseline Evidence

After rebasing `issue-156/focused-selection-boundary` onto `origin/main`, the unchanged generated
Expo web smoke was executed three consecutive times before applying any #156 implementation edits:

```bash
ANKH_STUDIO_ADMIN_WEB_SMOKE=1 bun test src/host/generatedAdminExpoWeb.smoke.test.ts
```

Results:

- pass 1: 1 pass, 20 assertions, generated app hydrated
- pass 2: 1 pass, 20 assertions, generated app hydrated
- pass 3: 1 pass, 20 assertions, generated app hydrated

The first sandboxed attempt failed with `EPERM` while binding `127.0.0.1`; rerunning with the
required localhost/browser permissions succeeded. The repaired smoke harness from PR #165 used the
smoke-only Studio manifest API and the symlinked single dependency graph. No copied dependency
directories or duplicate React graph workaround was reintroduced.

## Web Evidence

Commands executed with sandbox escalation because Expo web and Chrome DevTools require localhost
ports.

First, the focused implementation was applied locally and the template tests passed:

```bash
bun test src/host/layout/templates/rootLayout.test.ts src/host/layout/templates/rootLayout.selectionDom.test.ts
```

Then the real generated Expo web smoke was executed:

```bash
ANKH_STUDIO_ADMIN_WEB_SMOKE=1 bun test src/host/generatedAdminExpoWeb.smoke.test.ts
```

The generated app hydrated in Chrome and rendered the application DOM. The generated fixture was
extended locally to include:

- `Panel > Card`
- `Button > Text`
- an exposed `Panel`
- `DisclosureSection`

The actual DOM checks reached the Studio boundaries and produced:

```text
authoredButtonCount: 1
boundaryCount: 52
nestedButtonCount: 0
studioRoleButtonCount: 0
studioTabIndexCount: 52
```

The focused clone-removal shape fixed the previously observed nested-button symptom in this web
fixture:

- `Panel > Card`: `button button` count was `0`
- `Button > Text`: authored button count was `1`

However, the remaining outer `Pressable` was not semantically transparent. A representative
rendered boundary was:

```html
<div
  tabindex="0"
  class="css-view-g5y9jx r-cursor-1loqt21 r-touchAction-1otgn73"
  data-testid="studio-runtime-node-dashboard-nested-card"
  style="display: contents;"
></div>
```

Measured browser semantics for that boundary:

- tag name: `div`
- role attribute: absent
- `tabindex`: `0`
- computed `pointer-events`: `auto`
- class behavior included React Native Web cursor and touch-action classes

This violates the issue requirement that the Studio boundary add no focusability or `tabindex`.

A follow-up diagnostic run relaxed only the `tabindex` assertion to continue collecting evidence.
It showed duplicate same-node Studio boundaries in the DOM sample:

```html
<div data-testid="studio-runtime-node-dashboard-nested-card" style="display: contents;">
  <div data-testid="studio-runtime-node-dashboard-nested-card" style="display: contents;"></div>
</div>
```

The run then could not resolve a measurable click target for
`[data-testid="studio-runtime-node-dashboard-nested-card"]`, because the selected boundary elements
themselves were `display: contents`. This was not pursued further because the executed web semantic
gate had already failed.

The decisive `DisclosureSection` interaction and Preview assertions were not executed after the
focusability failure. The issue requires NO-GO when any executed platform fails validation.

## Historical Blocker

The earlier first pass on this branch was blocked by the broken generated Expo web smoke harness.
At that time, the generated app did not hydrate and Chrome reported:

```text
TypeError: Cannot read properties of null (reading 'useRef')
    at exports.useRef
    at useLatestCallback
    at NavigationContainerInner
```

That earlier result was an environmental blocker, not proof that the outer boundary architecture was
impossible. The new evidence above is different: after PR #165 repaired the smoke harness, the app
hydrated and the focused boundary produced an actual rendered DOM semantic failure.

## Native Evidence

Android and iOS were not executed for this focused pass because the executed web semantic gate
failed first. No native layout-safety conclusion is claimed here.

## Conclusion

Outcome: **NO-GO**

The existing outer Studio `Pressable` boundary cannot remain the selection interaction layer for
issue #156 in its focused form. Even after removing cloned authored-component props, React Native
Web renders the boundary as focusable DOM (`tabindex="0"`) with pointer behavior. That changes
Studio canvas semantics and violates the approved acceptance criteria.

Because the executed web platform failed, the implementation was not committed and no
implementation PR should be opened. The next alternative is a Studio-owned Edit-mode canvas
selection approach that does not rely on a per-node `Pressable` boundary as the semantic interaction
layer and does not mutate Runtime, ZORA, Surface, Contracts, templates, or another repository.
