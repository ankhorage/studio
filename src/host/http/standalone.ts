import { startStudioHostServer } from './server';

const portValue = process.env.ANKHORAGE_STUDIO_HOST_PORT;
const port = portValue === undefined ? 3000 : Number.parseInt(portValue, 10);
if (!Number.isInteger(port) || port < 1 || port > 65_535) {
  throw new Error(`Invalid ANKHORAGE_STUDIO_HOST_PORT: ${portValue}`);
}

await startStudioHostServer({ port, host: '127.0.0.1' });
