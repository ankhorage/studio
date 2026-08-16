export async function pickProjectDeployImage(): Promise<{
  readonly filename: string;
  readonly data: Uint8Array;
} | null> {
  const { getDocumentAsync } = await import('expo-document-picker');
  const result = await getDocumentAsync({
    type: ['image/png', 'image/jpeg'],
    copyToCacheDirectory: true,
    multiple: false,
  });
  if (result.canceled) return null;

  const [asset] = result.assets;
  if (!asset) return null;
  if (asset.file) {
    return {
      filename: asset.name,
      data: new Uint8Array(await asset.file.arrayBuffer()),
    };
  }

  const { File } = await import('expo-file-system');
  const file = new File(asset.uri);
  return {
    filename: asset.name,
    data: new Uint8Array(await file.arrayBuffer()),
  };
}
