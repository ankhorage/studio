# Generated project lifecycle

The local Studio host supports one generated-project architecture derived from the current
canonical manifest and generation state.

## ProjectCreate

ProjectCreate selects current product defaults, persists them in `ankh.config.json`, records Studio
inclusion in `.ankh/generation-state.json`, generates the current app output, and initializes
`.ankh/route-ledger.json` with the files owned by route generation.

## ProjectSync

ProjectSync requires a valid canonical manifest, target state, Studio-inclusion state when the
caller does not supply it explicitly, and a supported route ownership ledger. It derives current
output and removes only files present in the previous ownership ledger but absent from the next
ledger. Files outside that owned set are preserved. Missing or malformed required state is an
explicit error, and filesystem failures prevent sync from reporting success.

Scaffold synchronization similarly updates only current generator-owned files and dependencies.
Application-owned source directories and Expo configuration files are outside that ownership.

This lifecycle keeps the local Studio host on the same manifest, Runtime, ZORA, adapter, module,
and route-generation primitives used by ordinary Ankhorage applications.
