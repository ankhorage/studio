import type { StoreListingLocale } from '@ankhorage/deploy/project';
import { Button, Card, ConfirmDialog, Select, Text } from '@ankhorage/zora';
import React, { useEffect, useState } from 'react';

import {
  removeProjectDeployListingLocale,
  writeProjectDeployListingLocale,
} from '../../../../projectDeployApi';
import { Field, Input, KeyValue } from '../../adminPagePrimitives';
import type { ProjectDeployDashboardState } from './deployDashboardTypes';

const NEW_LOCALE = '__new__';

interface LocaleDraft {
  readonly locale: string;
  readonly name: string;
  readonly summary: string;
  readonly description: string;
  readonly keywords: string;
  readonly promotionalText: string;
  readonly supportUrl: string;
  readonly marketingUrl: string;
  readonly privacyPolicyUrl: string;
  readonly promoVideoUrl: string;
}

const EMPTY_DRAFT: LocaleDraft = {
  locale: '',
  name: '',
  summary: '',
  description: '',
  keywords: '',
  promotionalText: '',
  supportUrl: '',
  marketingUrl: '',
  privacyPolicyUrl: '',
  promoVideoUrl: '',
};

export function DeployListingLocaleAuthoringCard(props: {
  readonly projectId: string;
  readonly listing: ProjectDeployDashboardState['listing'];
  readonly onMutation: () => void;
}) {
  const [selected, setSelected] = useState(NEW_LOCALE);
  const [draft, setDraft] = useState<LocaleDraft>(EMPTY_DRAFT);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);

  useEffect(() => {
    if (props.listing.status !== 'ready' || selected === NEW_LOCALE) return;
    const locale = props.listing.data.locales.find((candidate) => candidate.locale === selected);
    if (locale) setDraft(toDraft(locale));
  }, [props.listing, selected]);

  const options = [
    { value: NEW_LOCALE, label: 'New locale' },
    ...(props.listing.status === 'ready'
      ? props.listing.data.locales.map((locale) => ({
          value: locale.locale,
          label: `${locale.locale} · ${locale.name}`,
        }))
      : []),
  ];

  const selectLocale = (value: string) => {
    setSelected(value);
    setError(null);
    if (value === NEW_LOCALE) setDraft(EMPTY_DRAFT);
  };

  const save = async () => {
    setBusy(true);
    setError(null);
    try {
      await writeProjectDeployListingLocale(props.projectId, toOwnerLocale(draft));
      setSelected(draft.locale.trim());
      props.onMutation();
    } catch (caught) {
      setError(readError(caught));
    } finally {
      setBusy(false);
    }
  };

  const remove = async () => {
    if (selected === NEW_LOCALE) return;
    setConfirmDelete(false);
    setBusy(true);
    setError(null);
    try {
      await removeProjectDeployListingLocale(props.projectId, selected);
      setSelected(NEW_LOCALE);
      setDraft(EMPTY_DRAFT);
      props.onMutation();
    } catch (caught) {
      setError(readError(caught));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Card
      title="Store listing locales"
      description="Create, update, or remove canonical locale metadata through Deploy's project authoring API."
    >
      {props.listing.status === 'ready' ? (
        <KeyValue label="Listing revision" value={props.listing.data.revision} />
      ) : null}
      <Field label="Locale entry">
        <Select value={selected} options={options} onValueChange={selectLocale} />
      </Field>
      <Field label="Locale">
        <Input
          value={draft.locale}
          placeholder="en-US"
          onChangeText={(locale) => setDraft({ ...draft, locale })}
        />
      </Field>
      <Field label="Store name">
        <Input value={draft.name} onChangeText={(name) => setDraft({ ...draft, name })} />
      </Field>
      <Field label="Summary">
        <Input value={draft.summary} onChangeText={(summary) => setDraft({ ...draft, summary })} />
      </Field>
      <Field label="Description">
        <Input
          multiline
          numberOfLines={5}
          value={draft.description}
          onChangeText={(description) => setDraft({ ...draft, description })}
        />
      </Field>
      <Field label="Keywords (comma separated)">
        <Input
          value={draft.keywords}
          onChangeText={(keywords) => setDraft({ ...draft, keywords })}
        />
      </Field>
      <Field label="Promotional text">
        <Input
          value={draft.promotionalText}
          onChangeText={(promotionalText) => setDraft({ ...draft, promotionalText })}
        />
      </Field>
      <Field label="Support URL">
        <Input
          value={draft.supportUrl}
          onChangeText={(supportUrl) => setDraft({ ...draft, supportUrl })}
        />
      </Field>
      <Field label="Marketing URL">
        <Input
          value={draft.marketingUrl}
          onChangeText={(marketingUrl) => setDraft({ ...draft, marketingUrl })}
        />
      </Field>
      <Field label="Privacy policy URL">
        <Input
          value={draft.privacyPolicyUrl}
          onChangeText={(privacyPolicyUrl) => setDraft({ ...draft, privacyPolicyUrl })}
        />
      </Field>
      <Field label="Promo video URL">
        <Input
          value={draft.promoVideoUrl}
          onChangeText={(promoVideoUrl) => setDraft({ ...draft, promoVideoUrl })}
        />
      </Field>
      {props.listing.status === 'loading' ? <Text>Loading listing…</Text> : null}
      {props.listing.status === 'error' ? (
        <Text color="danger">{props.listing.message}</Text>
      ) : null}
      {error ? <Text color="danger">{error}</Text> : null}
      <Button
        disabled={busy || draft.locale.trim() === '' || draft.name.trim() === ''}
        onPress={() => void save()}
      >
        {busy ? 'Saving…' : 'Save locale'}
      </Button>
      {selected !== NEW_LOCALE ? (
        <Button disabled={busy} variant="outline" onPress={() => setConfirmDelete(true)}>
          Remove locale
        </Button>
      ) : null}
      <ConfirmDialog
        visible={confirmDelete}
        title="Remove store listing locale?"
        description={`Remove ${selected} through the Deploy owner API? Unrelated locales and assets remain owner-managed.`}
        confirmLabel="Remove locale"
        confirmColor="danger"
        cancelLabel="Cancel"
        onCancel={() => setConfirmDelete(false)}
        onConfirm={() => void remove()}
      />
    </Card>
  );
}

function toDraft(locale: StoreListingLocale): LocaleDraft {
  return {
    locale: locale.locale,
    name: locale.name,
    summary: locale.summary ?? '',
    description: locale.description ?? '',
    keywords: locale.keywords?.join(', ') ?? '',
    promotionalText: locale.promotionalText ?? '',
    supportUrl: locale.supportUrl ?? '',
    marketingUrl: locale.marketingUrl ?? '',
    privacyPolicyUrl: locale.privacyPolicyUrl ?? '',
    promoVideoUrl: locale.promoVideoUrl ?? '',
  };
}

function toOwnerLocale(draft: LocaleDraft): StoreListingLocale {
  const keywords = draft.keywords
    .split(',')
    .map((keyword) => keyword.trim())
    .filter((keyword) => keyword.length > 0);
  return {
    locale: draft.locale.trim(),
    name: draft.name.trim(),
    ...optionalField('summary', draft.summary),
    ...optionalField('description', draft.description),
    ...(keywords.length > 0 ? { keywords } : {}),
    ...optionalField('promotionalText', draft.promotionalText),
    ...optionalField('supportUrl', draft.supportUrl),
    ...optionalField('marketingUrl', draft.marketingUrl),
    ...optionalField('privacyPolicyUrl', draft.privacyPolicyUrl),
    ...optionalField('promoVideoUrl', draft.promoVideoUrl),
  };
}

function optionalField<Key extends string>(key: Key, value: string): Partial<Record<Key, string>> {
  const trimmed = value.trim();
  return trimmed === '' ? {} : ({ [key]: trimmed } as Record<Key, string>);
}

function readError(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
