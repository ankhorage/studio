# Missing files for `ankhorage/studio#44`

Apply this on branch:

```bash
git checkout 37-39-migrate-studio-product
```

Copy the files from this ZIP into the repository root, preserving paths.

Then remove the temporary placeholder files that are currently on the branch:

```bash
rm -f src/app/StudioApp.ts src/app/StudioDashboard.ts
```

The branch already has `tsconfig.build.json` changed to include the `.tsx` app/dashboard files and dashboard dependencies.

One manual package.json adjustment is still needed because the connector blocked the package update:

```json
"peerDependencies": {
  "@expo/vector-icons": "^15.0.3",
  "expo-constants": "~18.0.13",
  "expo-font": "~14.0.12",
  "expo-router": "~6.0.22",
  "expo-status-bar": "^3.0.9",
  "react": "19.1.0",
  "react-native": "0.81.5",
  "react-native-safe-area-context": "~5.6.0"
}
```

After copying, run:

```bash
bun install
bun run format
bun run build
bun run type-check
bun run changeset:status
bun run type-check:studio
bun run dev:studio
```

Then fix any remaining type errors from current package versions / zora API differences.
