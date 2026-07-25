# Studio Selection Edit Canvas Renderer Validation

## Result

Status: **NO-GO**

This spike continued issue #156 after the focused per-node `Pressable` boundary failed in commit
`4d60042`. The web portion of a Studio-owned Edit-mode canvas interaction architecture passed in a
real generated Expo web app, but the selected implementation did not provide the mandatory native
Android/iOS hit-testing and action-suppression path. The production and test implementation changes
were therefore reverted. This commit records evidence only.

## Baseline

Branch created from current `origin/main`:

```text
issue-156/edit-mode-canvas-renderer-spike
```

Before implementation, the unchanged generated Expo web smoke was executed three consecutive times:

```bash
ANKH_STUDIO_ADMIN_WEB_SMOKE=1 bun test src/host/generatedAdminExpoWeb.smoke.test.ts
```

Results:

- pass 1: 1 pass, 20 assertions, generated app hydrated
- pass 2: 1 pass, 20 assertions, generated app hydrated
- pass 3: 1 pass, 20 assertions, generated app hydrated

This confirmed the PR #165 generated-web-smoke repair was still healthy before the architecture
spike.

## Previous NO-GO

The focused outer-boundary branch failed after hydration because React Native Web rendered the
per-node Studio `Pressable` boundary as focusable DOM:

```html
<div
  tabindex="0"
  data-testid="studio-runtime-node-dashboard-nested-card"
  style="display: contents;"
></div>
```

Observed there:

- `Panel > Card`: no nested `button button`
- `Button > Text`: exactly one authored button
- explicit Studio boundary role: absent
- Studio-added `tabindex`: 52
- computed `pointer-events`: `auto`

That failure rejected the per-node interactive boundary, not the generated web smoke environment.

## Candidates

### Candidate A: Canvas Capture Controller With Inert Markers

Runtime `wrapNode` emits non-interactive `View` markers with `display: contents` and `testID`
identity only. A single Studio-owned web controller installs capture-phase `pointerdown`,
`pointermove`, `pointerup`, and `click` listeners on `document`. The controller resolves the
deepest marker from `event.composedPath()`, suppresses the event before authored React Native Web
press handlers receive it, and updates Studio selection once on `pointerup` when movement stays
below a drag threshold.

Selection chrome is a separate fixed-position Studio `View` measured from the selected marker's
owned rendered descendants. Authored components are not cloned and receive no Studio `onPress`,
style, role, focus, or accessibility props.

This candidate was selected for the web proof because it eliminates per-node interactive Studio
boundaries and uses Runtime's existing public `wrapNode` hook without changing Runtime, ZORA,
Surface, Contracts, templates, React Native, or React Native Web.

### Candidate B: Native/Web Hit Registry Using Host Refs

Runtime `wrapNode` could emit per-node non-interactive host refs and register measured bounds for a
central hit tester. This is plausible for web with DOM refs and `ResizeObserver`, but native layout
transparency and ref measurability would need to be proven for every relevant component. Earlier
native feasibility evidence showed that assuming `display: contents` plus a per-node React Native
boundary is unsafe.

This candidate was not selected for this spike because it needs a native measurement feasibility
gate before production use.

### Candidate C: Separate Hit/Chrome Overlay

A single overlay could render hit regions and chrome above authored content. This avoids authored
prop mutation and per-node interactive wrappers, but it still requires a reliable cross-platform
registry of authored node geometry. It is a likely next architecture direction after this NO-GO,
not something this spike could prove without solving native measurement first.

## Selected Web Architecture

Attempted generated Edit mode:

- `wrapNode: previewMode ? undefined : wrapStudioRuntimeNode`
- `disableActions: !previewMode`
- no `cloneElement`
- no `isValidElement`
- no cloned `onPress`
- no cloned selected, hover, or focus style
- no per-node `Pressable`
- per-node marker component: React Native `View`
- marker props: `testID={\`studio-runtime-node-\${props.nodeId}\`}`, `style={display: 'contents'}`
- marker handlers: none
- marker accessibility props: none
- one Edit-only `StudioCanvasEditController`
- one independent `studio-selection-chrome` `View` with `pointerEvents="none"`
- Preview used `wrapNode: undefined` and did not render the controller or chrome
- switching between Edit and Preview was deliberately allowed to remount authored Runtime nodes

Web event flow proven in Chrome:

```text
pointerdown capture
→ deepest marker resolved from composed path
→ event preventDefault/stopPropagation/stopImmediatePropagation
→ pointermove tracks drag threshold
→ pointerup capture selects once when not dragged
→ click capture is suppressed without an additional selection update
```

## Web Evidence

The generated web smoke fixture was temporarily extended to include:

- `Panel > Card`
- `Button > Text`
- exposed `Panel`
- `SectionHeader`
- `DisclosureSection`
- nested `Stack`, `Inline`, and `Grid`
- an Edit/Preview app-bar toggle
- independent selected-node chrome

The completed real Chrome smoke passed three consecutive times after implementation:

```bash
ANKH_STUDIO_ADMIN_WEB_SMOKE=1 bun test src/host/generatedAdminExpoWeb.smoke.test.ts
```

Results:

- pass 1: 1 pass, 57 assertions
- pass 2: 1 pass, 57 assertions
- pass 3: 1 pass, 57 assertions

Actual web findings:

- generated app hydrated in Chrome
- `Panel > Card` nested `button button` count: 0
- `Button > Text` authored button count: 1
- Studio marker role count: 0
- Studio marker `tabindex` count: 0
- sample marker tag: `div`
- sample marker role: absent
- sample marker `tabindex`: absent
- sample marker pointer events: `auto`
- marker was non-interactive: no marker handlers and no button semantics
- clicking nested `Card` selected `dashboard-nested-card`
- clicking exposed `Panel` selected `dashboard-exposed-panel`
- selection debug counter showed one selection update per tested gesture
- `DisclosureSection` Edit selection selected `dashboard-disclosure`
- `DisclosureSection` did not toggle during Edit selection
- authored `Button` Edit selection selected `dashboard-authored-button`
- authored `Button` action did not execute during Edit selection
- selected chrome rendered independently through `studio-selection-chrome`
- chrome remained measurable after scroll and viewport resize
- drag movement above threshold did not produce a selection update
- Preview removed all Studio node markers
- Preview removed selected chrome
- Preview restored authored `DisclosureSection` toggling
- Preview restored authored `Button` action execution
- generated source contained no clone-based selection handler or style injection

Scroll note: the passing smoke targeted the actual RNW scroll container center with a Chrome wheel
event. Earlier fixed-coordinate wheel attempts did not move the scroll container because the pointer
was not over the scroll owner.

## Native Evidence

Android environment:

```bash
emulator -list-avds
```

Available AVD:

```text
Pixel_8_Pro_API_34-ext11
```

The emulator was started successfully:

```bash
emulator -avd Pixel_8_Pro_API_34-ext11 -no-snapshot -no-audio -no-window
```

`adb devices` then reported:

```text
emulator-5554    device
```

iOS environment:

```bash
xcodebuild -version
```

reported:

```text
Xcode 26.6
Build version 17F113
```

No iOS simulator was booted. `xcrun simctl list devices booted` listed runtime headings only:

```text
-- iOS 18.0 --
-- iOS 18.5 --
-- iOS 26.2 --
```

Native validation was not executed against the attempted implementation because the selected
implementation was explicitly web-only:

- the central controller depended on public DOM APIs: `document`, `Element`,
  `event.composedPath()`, `HTMLElement`, and `getBoundingClientRect()`
- native Edit mode would have inert marker `View`s but no native capture controller
- native Edit mode would not be able to resolve deepest node hit-testing
- native Edit mode would not suppress authored `DisclosureSection` or `Button` actions
- native Edit mode would not render validated native selected chrome

Because Android and iOS selection, action suppression, and chrome are mandatory for this issue, this
architecture cannot be accepted as-is even though the web proof passed.

## Validation Commands

Executed before implementation:

```bash
ANKH_STUDIO_ADMIN_WEB_SMOKE=1 bun test src/host/generatedAdminExpoWeb.smoke.test.ts
ANKH_STUDIO_ADMIN_WEB_SMOKE=1 bun test src/host/generatedAdminExpoWeb.smoke.test.ts
ANKH_STUDIO_ADMIN_WEB_SMOKE=1 bun test src/host/generatedAdminExpoWeb.smoke.test.ts
```

Executed during the reverted spike:

```bash
bun test src/host/layout/templates/rootLayout.test.ts src/host/layout/templates/rootLayout.selectionDom.test.ts
bun test src/host/generatedAdminExpoWeb.smoke.test.ts
bunx ankhorage-prettier --check src/host/generatedAdminExpoWeb.smoke.test.ts src/host/layout/templates/rootLayout.ts src/host/layout/templates/rootLayout.test.ts src/host/layout/templates/rootLayout.selectionDom.test.ts
ANKH_STUDIO_ADMIN_WEB_SMOKE=1 bun test src/host/generatedAdminExpoWeb.smoke.test.ts
ANKH_STUDIO_ADMIN_WEB_SMOKE=1 bun test src/host/generatedAdminExpoWeb.smoke.test.ts
ANKH_STUDIO_ADMIN_WEB_SMOKE=1 bun test src/host/generatedAdminExpoWeb.smoke.test.ts
```

Native availability commands:

```bash
adb devices
xcrun simctl list devices booted
xcodebuild -version
emulator -list-avds
emulator -avd Pixel_8_Pro_API_34-ext11 -no-snapshot -no-audio -no-window
adb devices
```

Repository-wide `typecheck`, `format:check`, `lint`, `knip`, and `changeset:status` were not run
after reverting the implementation because this branch retains evidence only.

## Conclusion

Outcome: **NO-GO**

The selected central web capture controller with inert markers is a viable web direction, but it is
not a complete issue #156 architecture because it does not provide native hit-testing, native
authored-action suppression, or native chrome. The next reviewable step should start with a native
measurement/hit-test feasibility gate for a Studio-owned geometry registry or overlay layer, then
reuse the web capture findings where appropriate.

No implementation PR should be opened from this branch, and issue #156 is not fixed.
