import { ExpoZoraIconFontProvider } from '@ankhorage/expo-runtime/icon-fonts';
import { StudioApp } from '@ankhorage/studio/app';

export default function RootLayout() {
  return (
    <ExpoZoraIconFontProvider>
      <StudioApp />
    </ExpoZoraIconFontProvider>
  );
}
