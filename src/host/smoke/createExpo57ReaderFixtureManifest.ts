import type { AppManifest, ScreenSpec } from '@ankhorage/contracts';
import { createOAuthFixtureManifest } from '@ankhorage/templates';

const READER_FORMATS = ['epub', 'pdf'] as const;

/*** Create the Expo 57 reader-parity manifest used by EPUB/PDF acceptance fixtures.
 * @todo Move this fixture manifest builder from src/host/smoke to test/smoke.
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

/*** Create one reader-surface screen for a specific fixture format. */
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

/*** Create an event-source binding value for a fixture event payload path. */
function eventValue(path: string) {
  return { kind: 'source' as const, source: { kind: 'event' as const, path } };
}
