import { readdir, readFile } from 'node:fs/promises';
import path from 'node:path';

export async function assertExpo57GeneratedCapabilityNativePrebuildAsync(
  projectRoot: string,
): Promise<void> {
  const androidRoot = path.join(projectRoot, 'android');
  const [androidManifest, androidBuild, androidAppBuild, gradleProperties] = await Promise.all([
    readFile(path.join(androidRoot, 'app', 'src', 'main', 'AndroidManifest.xml'), 'utf8'),
    readFile(path.join(androidRoot, 'build.gradle'), 'utf8'),
    readFile(path.join(androidRoot, 'app', 'build.gradle'), 'utf8'),
    readFile(path.join(androidRoot, 'gradle.properties'), 'utf8'),
  ]);
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

  for (const [source, expected] of [
    [androidBuild, 'apply plugin: "expo-root-project"'],
    [androidAppBuild, 'compileSdk rootProject.ext.compileSdkVersion'],
    [androidAppBuild, 'minSdkVersion rootProject.ext.minSdkVersion'],
    [androidAppBuild, 'targetSdkVersion rootProject.ext.targetSdkVersion'],
  ] as const) {
    if (!source.includes(expected)) {
      throw new Error(`Android prebuild is missing Expo-owned platform binding ${expected}.`);
    }
  }
  if (!gradleProperties.includes('newArchEnabled=true')) {
    throw new Error('Android prebuild did not retain the New Architecture baseline.');
  }

  const iosFiles = await listFilesAsync(path.join(projectRoot, 'ios'));
  const infoPlistPath = iosFiles.find((file) => file.endsWith('Info.plist'));
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
  const iosProjectPath = iosFiles.find((file) => file.endsWith('project.pbxproj'));
  if (!iosProjectPath) throw new Error('iOS prebuild did not generate an Xcode project.');
  const iosProject = await readFile(iosProjectPath, 'utf8');
  if (!iosProject.includes('IPHONEOS_DEPLOYMENT_TARGET = 16.4;')) {
    throw new Error('iOS prebuild is missing the Expo 57 minimum deployment target.');
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
