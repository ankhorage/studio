import type { AppManifest, ScreenSpec } from '@ankhorage/contracts';

import { createOAuthFixtureManifest } from './createOAuthFixtureManifest';

const READER_FORMATS = ['epub', 'pdf'] as const;

/***
 * Build the Expo 57 reader-parity acceptance manifest, including reader screens, bundled media and event bindings for each supported fixture format.
 */
export function createExpo57ReaderFixtureManifest(): AppManifest {
  const manifest = createOAuthFixtureManifest({
    category: 'books_reading',
    fixture: 'google',
    overrides: {
      metadata: {
        name: 'Expo 57 Reader Parity Acceptance',
        slug: 'expo-57-reader-parity-acceptance',
      },
    },
  });

  const screens = Object.fromEntries(
    READER_FORMATS.map((format) => [format, createReaderScreen(format)]),
  );

  return {
    ...manifest,
    deploy: {
      targets: {
        android: {
          enabled: true,
          package: 'com.ankhorage.expo57readerparity',
          scheme: 'ankh-expo57-reader-android',
        },
        ios: {
          bundleIdentifier: 'com.ankhorage.expo57readerparity',
          enabled: true,
          scheme: 'ankh-expo57-reader-ios',
        },
        web: { enabled: true },
      },
    },
    media: {
      assets: Object.fromEntries(
        READER_FORMATS.map((format) => [
          `reader-${format}`,
          {
            contentType: format === 'epub' ? 'application/epub+zip' : 'application/pdf',
            id: `reader-${format}`,
            kind: 'file',
            name: `Reader ${format.toUpperCase()}`,
            source: {
              kind: 'bundled',
              path: `assets/authoring/reader/sample.${format}`,
            },
          },
        ]),
      ),
    },
    navigator: {
      type: 'stack',
      initialRouteName: 'reader-epub',
      routes: READER_FORMATS.map((format) => ({
        name: `reader-${format}`,
        path: `reader/${format}`,
        screenId: format,
      })),
    },
    screens,
  };
}

/***
 * Build one reader fixture screen for the requested format and wire it to the matching bundled media asset.
 */
function createReaderScreen(format: (typeof READER_FORMATS)[number]): ScreenSpec {
  return {
    id: format,
    name: `${format.toUpperCase()} Reader`,
    requires: { capabilities: { ebookReader: true } },
    root: {
      id: `reader-screen-${format}`,
      type: 'Screen',
      props: { scroll: false },
      children: [
        {
          id: `reader-${format}`,
          type: 'Reader',
          props: {
            format,
            source: { mediaId: `reader-${format}` },
            title: `Reader ${format.toUpperCase()} fixture`,
          },
        },
      ],
    },
  };
}
