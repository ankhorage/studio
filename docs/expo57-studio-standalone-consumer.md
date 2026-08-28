# Expo 57 Studio standalone consumer

`apps/studio` is an ordinary Expo 57 consumer of released Ankhorage packages. It owns its install,
tooling, Expo CLI, configuration, CNG, and native-build contract and uses Expo Router directly.

## Consumer contract

The application declares Node 24, Bun 1.3.14, every imported Runtime dependency, and every invoked
tool directly. Ordinary application scripts never invoke a parent build, and TypeScript has no
parent source or `dist` alias.

Before TypeScript runs, the app-owned Expo CLI generates typed Router declarations. The platform
check rejects unresolved package ownership, parent scripts, and non-release dependency sources.
Expo-default Babel and Metro behavior remains unchanged, React Compiler is enabled through Expo
configuration, and app-owned source/configuration files remain outside Studio generator ownership.

The app uses static Web output, stable native schemes and application identifiers, and the scoped
React Native Vector Icons config plugins required to register linked fonts on iOS.

## Permanent acceptance topology

Run the complete consumer proof with:

```bash
bun run test:acceptance:expo57-studio-standalone
```

The harness copies only committed application consumer files into a fresh directory outside the
checkout. That directory is both package root and installation root; a separate temporary host
fixture serves only the HTTP behavior exercised by the application.

The acceptance performs a cold frozen install, verifies registry provenance and the physical
dependency graph, requires one compatible React Native 0.86.3 installation, and hashes the lockfile
before and after all checks. It then runs the platform assertion, Router type generation,
TypeScript, lint, formatting, Expo dependency compatibility, Expo Doctor, React Compiler health,
development Web navigation, static Web export/hydration, Android/iOS JavaScript export, and clean
CNG assertions.

Browser evidence covers direct URLs, nested routes, path/search parameters, reload, and browser
Back/Forward. Native generation assertions cover schemes, application identifiers, edge-to-edge,
the iOS 16.4 deployment target, and static icon-font registration. Development and Release builds
use freshly regenerated native projects and rebuilt development clients.

## Package boundary and convergence

Host-only acceptance orchestration stays under `src/host/`. The application consumes Studio,
Runtime, ZORA, adapter, module, route, action, and data contracts in the same way as an ordinary
generated Ankhorage app, reducing the architectural distance between the two consumers without a
Studio-only integration path.
