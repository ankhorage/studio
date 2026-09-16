# Generated project lifecycle

The local Studio host supports one generated-project architecture derived from the current
canonical manifest and generation state.

## ProjectCreate

ProjectCreate selects current product defaults, persists them in `ankh.config.json`, records Studio
inclusion in `.ankh/generation-state.json`, generates the current app output, and initializes
`.ankh/route-ledger.json` with the files owned by route generation. After the complete generated
runtime and package projection succeeds, the same generation-state document records the exact
runtime-relevant manifest signature that was applied.

## Runtime projection

Runtime projection requires a valid canonical manifest, target state, persisted Studio-inclusion
state, and a supported route ownership ledger. It derives current output and removes only files
present in the previous ownership ledger but absent from the next ledger. Files outside that owned
set are preserved. Missing or malformed required state is an explicit error, and filesystem
failures prevent projection from reporting success.

Scaffold projection similarly updates only current generator-owned files and dependencies.
Application-owned source directories and Expo configuration files are outside that ownership. A
manifest whose runtime signature differs from the last applied signature is `pending`; a failed
projection records only its attempted signature and remains `failed` across later manifest-only
persistence. Generation state that predates runtime evidence resolves conservatively as `unknown`.

This lifecycle keeps the local Studio host on the same manifest, Runtime, ZORA, adapter, module,
and route-generation primitives used by ordinary Ankhorage applications.
