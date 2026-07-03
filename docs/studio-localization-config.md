# Studio localization config

`@ankhorage/studio/localizationConfig` provides package-neutral helpers for safely reading Studio localization module configuration and locale dictionaries.

## Import

```ts
import {
  isStringArray,
  isStringRecord,
  readLocalizationConfig,
} from '@ankhorage/studio/localizationConfig';
```

## Owned here

- checking unknown JSON values for string arrays
- checking unknown JSON values for string dictionaries
- reading optional `locales` from localization module config

## Host-owned concerns

Hosts still own fetching dictionaries, choosing active locale state, translation lookup, React effects, and bridge URL construction.
