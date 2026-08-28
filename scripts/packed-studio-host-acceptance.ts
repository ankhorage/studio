import { runPackedStudioHostAcceptance } from '../src/host/smoke/runPackedStudioHostAcceptance';

await runPackedStudioHostAcceptance({
  keepFixture: process.argv.includes('--keep'),
});
