import { runExpo57StudioStandaloneAcceptance } from '../src/host/smoke/runExpo57StudioStandaloneAcceptance';

await runExpo57StudioStandaloneAcceptance({
  keepFixture: process.argv.includes('--keep'),
});
