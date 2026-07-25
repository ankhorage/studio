# Studio Selection Focused Boundary Validation

## Result

Status: **NO-GO**

The focused outer-boundary implementation pass did not produce the required web validation result.
No implementation PR should be opened from this evidence, and this does not fix issue #156.

## Scope Attempted

The attempted production change was limited to:

```text
src/host/layout/templates/rootLayout.ts
```

The attempted implementation removed Studio's cloned rendered-component selection props and kept
selection on the Studio-owned outer boundary. The changes were not committed because the required
web validation did not pass.

## Web Evidence

Command executed with sandbox escalation because Expo web and Chrome DevTools require localhost
ports:

```bash
ANKH_STUDIO_ADMIN_WEB_SMOKE=1 bun test src/host/generatedAdminExpoWeb.smoke.test.ts -t "keeps Studio selection"
```

The focused generated Expo web smoke could not reach the rendered Studio canvas DOM.

Observed failures:

1. The temp generated Expo app initially served Expo's static error page because
   `@react-navigation/native` was not resolved from the temp project.
2. After the smoke harness was temporarily adjusted to copy React Navigation packages and include
   the repository node module roots, the bundle loaded but React did not hydrate the app.
3. Chrome reported:

```text
TypeError: Cannot read properties of null (reading 'useRef')
    at exports.useRef
    at useLatestCallback
    at NavigationContainerInner
```

The DOM remained limited to the Expo root and bundle script:

```html
<body>
  <div id="root"></div>
  <script src="/apps/generated-admin-web-smoke/index.bundle?..."></script>
</body>
```

Because the app did not hydrate, the pass could not verify:

- `Panel > Card` semantic DOM
- `Button > Text` semantic DOM
- deepest-node selection
- parent-surface fallback
- `DisclosureSection` edit-mode toggle suppression
- Preview interaction restoration
- actual Studio boundary role, tabindex, style, pointer-event, or DOM output

The pre-existing generated admin web smoke also failed in this environment, before the focused
selection assertions, with an empty `/dashboard` body. That indicates the current generated Expo web
smoke environment is not healthy enough to validate this boundary pass.

## Native Evidence

Android and iOS were not executed for this focused pass because the required web gate failed first.
No native layout-safety conclusion is claimed here.

## Conclusion

Outcome: **NO-GO**

This is a validation NO-GO, not proof that the outer boundary architecture is impossible. The
required web validation did not execute against a hydrated generated Expo web app, so the focused
implementation must not be committed or proposed as a PR.
