import { runExpo57StudioStandaloneAcceptance } from '../test/smoke/runExpo57StudioStandaloneAcceptance';

const publishedStudioVersion: unknown = process.env.STUDIO_PUBLISHED_VERSION;

await runExpo57StudioStandaloneAcceptance({
  keepFixture: process.argv.includes('--keep'),
  ...(typeof publishedStudioVersion === 'string' ? { publishedStudioVersion } : {}),
});
