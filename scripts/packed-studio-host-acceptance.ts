import { runPackedStudioHostAcceptance } from '../test/acceptance/runPackedStudioHostAcceptance';

await runPackedStudioHostAcceptance({
  keepFixture: process.argv.includes('--keep'),
});
