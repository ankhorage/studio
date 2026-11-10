import { readdir, readFile } from 'node:fs/promises';
import path from 'node:path';

const EXPO_OUTPUT_DIRECTORIES = ['dist', 'dist-android', 'dist-ios'] as const;
const READER_RUNTIME_MARKERS = ['@ankhorage/reader', 'pdfjs-dist', 'pdf.worker'] as const;

/***
 * Reject a Studio app Metro output that includes the optional Reader runtime or PDF.js worker.
 */
export async function assertExpo57StudioReaderFreeRuntimeAsync(fixtureRoot: string): Promise<void> {
  const bundlePaths = (
    await Promise.all(
      EXPO_OUTPUT_DIRECTORIES.map((directory) =>
        collectJavaScriptFilesAsync(path.join(fixtureRoot, directory)),
      ),
    )
  ).flat();
  if (bundlePaths.length === 0) {
    throw new Error('Studio Expo exports did not produce JavaScript bundles to inspect.');
  }
  const bundleContents = await Promise.all(
    bundlePaths.map((bundlePath) => readFile(bundlePath, 'utf8')),
  );
  for (const marker of READER_RUNTIME_MARKERS) {
    const bundlePath = bundlePaths.find((_, index) => bundleContents[index]?.includes(marker));
    if (bundlePath) {
      throw new Error(
        `Reader-free Studio app Metro output unexpectedly includes ${marker}: ${bundlePath}.`,
      );
    }
  }
}

/*** Recursively collect JavaScript and Hermes output files emitted by one Expo platform export. */
async function collectJavaScriptFilesAsync(directory: string): Promise<readonly string[]> {
  const entries = await readdir(directory, { withFileTypes: true });
  const paths = await Promise.all(
    entries.map(async (entry) => {
      const entryPath = path.join(directory, entry.name);
      if (entry.isDirectory()) return collectJavaScriptFilesAsync(entryPath);
      return entry.isFile() && /\.(?:hbc|js)$/u.test(entry.name) ? [entryPath] : [];
    }),
  );
  return paths.flat();
}
