import { resolveStandaloneStudioHostOptions } from './resolveStandaloneStudioHostOptions';
import { startStudioHostServerWithSecrets } from './serverWithSecrets';

const options = resolveStandaloneStudioHostOptions(process.env.ANKHORAGE_STUDIO_HOST_PORT);

await startStudioHostServerWithSecrets(options);
