const DEFAULT_API_BASE = 'http://localhost:3000/api';
const ANDROID_LOCAL_API_BASE = 'http://127.0.0.1:3000/api';

/***
 * Resolve the Studio host API base URL for explicit configuration, Android, Expo LAN hosts, or localhost.
 * @todo Move platform-specific Studio API endpoint resolution from core/ to platform/.
 */
export function resolveStudioApiBase(args: {
  readonly explicitApiBase: string | undefined;
  readonly expoHostUri: string | null;
  readonly platform: string;
}): string {
  if (args.explicitApiBase !== undefined) return args.explicitApiBase;
  if (args.platform === 'android') return ANDROID_LOCAL_API_BASE;

  if (args.expoHostUri !== null) {
    const [ip] = args.expoHostUri.split(':');
    return `http://${ip}:3000/api`;
  }

  return DEFAULT_API_BASE;
}
