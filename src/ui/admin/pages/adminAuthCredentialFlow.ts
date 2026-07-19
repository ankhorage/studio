import type { StudioAuthSettings } from '../../../authSettings';

export interface StoredOAuthCredentialLink {
  readonly providerId: string;
  readonly providerLabel: string;
  readonly credentialsRef: string;
  readonly nextDraft: StudioAuthSettings;
  readonly successMessage: string;
}

export type StoredOAuthCredentialLinkResult =
  | {
      readonly ok: true;
      readonly message: string;
    }
  | {
      readonly ok: false;
      readonly pendingLink: StoredOAuthCredentialLink;
      readonly message: string;
    };

export async function persistStoredOAuthCredentialLink(args: {
  readonly link: StoredOAuthCredentialLink;
  readonly updateAuthSettings: (settings: StudioAuthSettings) => void;
  readonly flushManifest: () => Promise<void>;
  readonly refreshHealth: () => Promise<void>;
  readonly toMessage: (error: unknown) => string;
}): Promise<StoredOAuthCredentialLinkResult> {
  args.updateAuthSettings(args.link.nextDraft);

  try {
    await args.flushManifest();
  } catch (error) {
    return {
      ok: false,
      pendingLink: args.link,
      message: `${args.link.providerLabel} credentials were saved, but the Studio manifest link could not be persisted: ${args.toMessage(error)}`,
    };
  }

  await args.refreshHealth();
  return { ok: true, message: args.link.successMessage };
}
