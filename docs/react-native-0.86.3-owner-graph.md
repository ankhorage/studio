# React Native 0.86.3 owner-graph audit

This audit closes the package-owner prerequisite discovered while reviewing Studio issue #314.
The Expo 57 application baseline is React Native 0.86.3, but the previously published Studio,
Runtime, Surface, and ZORA packages declared an exact React Native 0.86.2 peer. That combination
allowed Bun to install two React Native patches and emitted incompatible-peer warnings in the
standalone consumer.

## Ownership decision

The RN-facing portable owners support the React Native 0.86 patch line. Their public peer is
therefore `0.86.x`, while development and application validation remain pinned to the canonical
`0.86.3` baseline. Expo Runtime owns the narrower Expo platform projection and intentionally pins
React Native `0.86.3` and Expo `57.0.17` exactly.

The registry was checked before this Studio package change. The released prerequisite graph is:

| Owner                     | Released version | React Native peer |
| ------------------------- | ---------------- | ----------------- |
| `@ankhorage/runtime`      | `2.2.1`          | `0.86.x`          |
| `@ankhorage/surface`      | `3.0.1`          | `0.86.x`          |
| `@ankhorage/zora`         | `3.0.1`          | `0.86.x`          |
| `@ankhorage/expo-runtime` | `3.0.6`          | `0.86.3`          |
| `@ankhorage/studio`       | `2.0.9`          | `0.86.x`          |

Studio now publishes the same intentional `0.86.x` portable peer, raises its dependency floors to
those released owners, and validates `apps/studio` on React Native `0.86.3` and Expo `57.0.17`.
The patch changeset published this metadata as Studio 2.0.9.

## Boundary and acceptance

This change adds no source API and no compatibility path. Package-neutral Studio code stays
independent of Expo and React Native implementation details; only public package metadata and the
first-party ordinary-app validation baseline change. The final issue #314 acceptance consumed the
published Studio 2.0.9 tarball from the registry in a fixture that is itself both package and
installation root, with no workspace, source, `file:`, or `link:` fallback.

The permanent graph assertion passed for the standalone Studio consumer, generated capability app,
and final native fixture: every installed RN-facing Ankhorage owner accepts the one physical React
Native 0.86.3 installation. Android/iOS Debug and Release builds and fresh development clients were
then rebuilt, installed and launched from that final graph. The earlier 0.86.2 native evidence is
historical only.
