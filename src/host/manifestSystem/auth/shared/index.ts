import type { ManifestSystemTemplate } from '../../types';
import {
  applyGlobalAuthSystemTemplate,
  supportsGlobalAuthSystemTemplate,
} from './global.auth.system.tpl';

export const SYSTEM_TEMPLATE_AUTH_GLOBAL_DEFAULT: ManifestSystemTemplate = {
  id: 'auth.global.default',
  description: 'Shared global auth defaults for generated sign-in and sign-up flows.',
  applies: supportsGlobalAuthSystemTemplate,
  apply: applyGlobalAuthSystemTemplate,
};
