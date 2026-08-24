import { readdir, readFile } from 'node:fs/promises';
import path from 'node:path';

export async function assertExpo57GeneratedCapabilityNativePrebuildAsync(
  projectRoot: string,
): Promise<void> {
  const androidManifest = await readFile(
    path.join(projectRoot, 'android', 'app', 'src', 'main', 'AndroidManifest.xml'),
    'utf8',
  );
  for (const expected of [
    'android.permission.CAMERA',
    'android.permission.RECORD_AUDIO',
    'android.permission.ACCESS_FINE_LOCATION',
    'android.permission.ACCESS_BACKGROUND_LOCATION',
    'ankh-expo57-capabilities-android',
  ]) {
    if (!androidManifest.includes(expected)) {
      throw new Error(`Android prebuild is missing ${expected}.`);
    }
  }

  const infoPlistPath = (await listFilesAsync(path.join(projectRoot, 'ios'))).find((file) =>
    file.endsWith('Info.plist'),
  );
  if (!infoPlistPath) throw new Error('iOS prebuild did not generate an Info.plist.');
  const infoPlist = await readFile(infoPlistPath, 'utf8');
  for (const expected of [
    'CFBundleURLTypes',
    'ankh-expo57-capabilities-ios',
    'NSCameraUsageDescription',
    'NSLocationAlwaysAndWhenInUseUsageDescription',
    'NSLocationWhenInUseUsageDescription',
    'NSMicrophoneUsageDescription',
    'NSPhotoLibraryUsageDescription',
  ]) {
    if (!infoPlist.includes(expected)) {
      throw new Error(`iOS prebuild is missing ${expected}.`);
    }
  }
}

async function listFilesAsync(rootPath: string): Promise<string[]> {
  const entries = await readdir(rootPath, { withFileTypes: true });
  const files: string[] = [];
  for (const entry of entries) {
    const entryPath = path.join(rootPath, entry.name);
    if (entry.isDirectory()) files.push(...(await listFilesAsync(entryPath)));
    else if (entry.isFile()) files.push(entryPath);
  }
  return files;
}
