import { startStudioHostServer } from './server';

const rawPortValue: unknown = process.env.ANKHORAGE_STUDIO_HOST_PORT;
const portValue = typeof rawPortValue === 'string' ? rawPortValue : undefined;
const port = portValue === undefined ? 3000 : Number.parseInt(portValue, 10);
if (!Number.isInteger(port) || port < 1 || port > 65_535) {
  throw new Error(`Invalid ANKHORAGE_STUDIO_HOST_PORT: ${portValue}`);
}

await startStudioHostServer({ port, host: '127.0.0.1' });
