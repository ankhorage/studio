import type { AppManifest, ScreenSpec } from '@ankhorage/contracts';

import { createOAuthFixtureManifest } from './createOAuthFixtureManifest';

const READER_FORMATS = ['epub', 'pdf'] as const;

/***
 * Build the Expo 57 reader-parity acceptance manifest, including reader screens, bundled media and event bindings for each supported fixture format.
 * @todo Move this acceptance-fixture manifest builder from production src/host/smoke to test/smoke.
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
    dataBindings: Object.fromEntries(
      READER_FORMATS.map((format) => [
        `reader-${format}`,
        {
          componentId: `reader-${format}`,
          componentType: 'ReaderSurface',
          events: {
            locationChange: [
              {
                target: { kind: 'action', type: 'console' },
                input: {
                  format: eventValue('payload.format'),
                  locator: eventValue('payload.locator'),
                  page: eventValue('payload.page'),
                  progression: eventValue('payload.progression'),
                  trigger: eventValue('payload.trigger'),
                },
              },
            ],
            readerError: [
              {
                target: { kind: 'action', type: 'console' },
                input: {
                  code: eventValue('payload.code'),
                  format: eventValue('payload.format'),
                  message: eventValue('payload.message'),
                },
              },
            ],
          },
        },
      ]),
    ),
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
 * @todo Keep this helper with the reader acceptance fixture when src/host/smoke moves to test/smoke.
 */
function createReaderScreen(format: (typeof READER_FORMATS)[number]): ScreenSpec {
  return {
    id: format,
    name: `${format.toUpperCase()} Reader`,
    requires: { capabilities: [{ capability: 'ebookReader' }] },
    root: {
      id: `reader-screen-${format}`,
      type: 'Screen',
      props: { scroll: false },
      children: [
        {
          id: `reader-${format}`,
          type: 'ReaderSurface',
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

/***
 * Build a contracts event-source binding value for one payload path inside the reader acceptance manifest.
 * @todo Keep this contracts-shaped fixture helper inside test/smoke rather than extracting it as a generic Utility API.
 */
function eventValue(path: string) {
  return { kind: 'source' as const, source: { kind: 'event' as const, path } };
}
