import { readdir, readFile } from 'node:fs/promises';
import path from 'node:path';

export async function assertExpo57StudioNativePrebuildAsync(fixtureRoot: string): Promise<void> {
  const androidRoot = path.join(fixtureRoot, 'android');
  const iosRoot = path.join(fixtureRoot, 'ios');
  const [androidManifest, androidBuild, gradleProperties] = await Promise.all([
    readFile(path.join(androidRoot, 'app', 'src', 'main', 'AndroidManifest.xml'), 'utf8'),
    readFile(path.join(androidRoot, 'app', 'build.gradle'), 'utf8'),
    readFile(path.join(androidRoot, 'gradle.properties'), 'utf8'),
  ]);

  for (const evidence of [
    'android:windowSoftInputMode="adjustResize"',
    'android:scheme="ankhorage-studio"',
  ]) {
    if (!androidManifest.includes(evidence)) {
      throw new Error(`Android prebuild is missing ${evidence}.`);
    }
  }
  if (!androidBuild.includes("applicationId 'com.ankhorage.studio'")) {
    throw new Error('Android prebuild is missing the Studio application ID.');
  }
  if (!gradleProperties.includes('edgeToEdgeEnabled=true')) {
    throw new Error('Android prebuild did not retain Expo 57 edge-to-edge mode.');
  }
  for (const obsolete of ['androidStatusBar', 'androidNavigationBar', 'navigationBarColor']) {
    if (androidManifest.includes(obsolete) || gradleProperties.includes(obsolete)) {
      throw new Error(`Android prebuild contains obsolete ${obsolete} configuration.`);
    }
  }

  const iosProject = await resolveIosProjectAsync(iosRoot);
  const [infoPlist, projectFile] = await Promise.all([
    readFile(path.join(iosRoot, iosProject, 'Info.plist'), 'utf8'),
    readFile(path.join(iosRoot, `${iosProject}.xcodeproj`, 'project.pbxproj'), 'utf8'),
  ]);
  if (!infoPlist.includes('<string>ankhorage-studio</string>')) {
    throw new Error('iOS prebuild is missing the Studio URL scheme.');
  }
  for (const font of [
    'FontAwesome.ttf',
    'FontAwesome5_Solid.ttf',
    'FontAwesome6_Solid.ttf',
    'Ionicons.ttf',
  ]) {
    if (!infoPlist.includes(`<string>${font}</string>`)) {
      throw new Error(`iOS prebuild is missing the statically linked ${font} registration.`);
    }
  }
  if (!/PRODUCT_BUNDLE_IDENTIFIER = "?com\.ankhorage\.studio"?;/.test(projectFile)) {
    throw new Error('iOS prebuild is missing the Studio bundle identifier.');
  }
  if (!projectFile.includes('IPHONEOS_DEPLOYMENT_TARGET = 16.4;')) {
    throw new Error('iOS prebuild is missing the Expo 57 minimum deployment target.');
  }
}

async function resolveIosProjectAsync(iosRoot: string): Promise<string> {
  const entries = await readdir(iosRoot, { withFileTypes: true });
  const project = entries.find(
    (entry) => entry.isDirectory() && !entry.name.endsWith('.xcodeproj') && entry.name !== 'Pods',
  );
  if (!project) throw new Error('iOS prebuild did not generate an application project.');
  return project.name;
}
