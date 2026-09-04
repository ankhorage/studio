import { createServer } from 'node:net';

/*** Reserve an ephemeral loopback TCP port and return it after closing the reservation server.
 * @utility @ankhorage/utility/node/net
 */
export function reserveTcpPortAsync(label: string): Promise<number> {
  return new Promise((resolve, reject) => {
    const server = createServer();
    server.once('error', reject);
    server.listen(0, '127.0.0.1', () => {
      const address = server.address();
      if (typeof address !== 'object' || address === null) {
        server.close(() => reject(new Error(`Could not reserve a ${label} port.`)));
        return;
      }
      server.close(() => resolve(address.port));
    });
  });
}
