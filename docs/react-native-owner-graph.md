# React Native owner graph

The Expo 57 application baseline uses one physical React Native 0.86.3 installation.

Portable RN-facing Ankhorage packages declare the supported `0.86.x` patch line. Expo Runtime owns
the narrower platform projection and pins React Native 0.86.3 with its compatible Expo 57 graph.
Application validation remains pinned to that canonical baseline.

Permanent standalone Studio and generated-app acceptance scans the installed dependency graph,
requires exactly one React Native installation, and rejects incompatible peers from every installed
Ankhorage owner. Package-neutral Studio code remains independent of Expo and React Native
implementation details; only the ordinary application and platform packages own that integration.
