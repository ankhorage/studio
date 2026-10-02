import { runExpo57StudioStandaloneAcceptance } from '../test/smoke/runExpo57StudioStandaloneAcceptance';

await runExpo57StudioStandaloneAcceptance({
  keepFixture: process.argv.includes('--keep'),
});
