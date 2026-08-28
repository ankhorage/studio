import { ExpoZoraIconFontProvider } from '@ankhorage/expo-runtime/icon-fonts';
import { StudioApp } from '@ankhorage/studio';

export default function RootLayout() {
  return (
    <ExpoZoraIconFontProvider>
      <StudioApp />
    </ExpoZoraIconFontProvider>
  );
}
