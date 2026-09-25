import { DEPLOY_AUTHORING_STRUCTURE } from '@ankhorage/deploy/authoring';
import type { ProjectStoreListing, StoreListingLocale } from '@ankhorage/deploy/project';
import { Button, Card, Dialog, Select, Text, View } from '@ankhorage/zora';
import React, { useState } from 'react';

import { resolveContractsAuthoringStructure } from '../../../../features/authoring-engine/adapters/outbound/resolveContractsAuthoringStructure';
import {
  removeProjectDeployListingLocale,
  writeProjectDeployListingLocale,
} from '../../../../projectDeployApi';
import { Field, KeyValue } from '../../adminPagePrimitives';
import type { ProjectDeployDashboardState } from './deployDashboardTypes';
import { DeployOwnerAuthoringEditor } from './DeployOwnerAuthoringEditor';

const NEW_LOCALE = '__new__';
const EMPTY_LOCALE: StoreListingLocale = { locale: '', name: '' };
const LOCALE_STRUCTURE = resolveContractsAuthoringStructure(
  DEPLOY_AUTHORING_STRUCTURE,
  'store-listing-locale',
);

/*** Author store-listing locales from Deploy metadata while retaining locale selection/removal workflow. */
export function DeployListingLocaleAuthoringCard(props: {
  readonly projectId: string;
  readonly listing: ProjectDeployDashboardState['listing'];
  readonly onMutation: () => void;
}) {
  return (
    <Card
      title="Store listing locales"
      description="Locale metadata fields and ordered keywords come from Deploy's released owner structure; selection and removal remain workflow operations."
    >
      {props.listing.status === 'ready' ? (
        <>
          <KeyValue label="Listing revision" value={props.listing.data.revision} />
          <ListingLocaleDraftEditor
            key={props.listing.data.revision}
            projectId={props.projectId}
            listing={props.listing.data}
            onMutation={props.onMutation}
          />
        </>
      ) : null}
      {props.listing.status === 'loading' ? <Text>Loading listing…</Text> : null}
      {props.listing.status === 'error' ? (
        <Text color="danger">{props.listing.message}</Text>
      ) : null}
    </Card>
  );
}

/*** Edit one revision-scoped locale draft while locale selection and deletion remain workflow state. */
function ListingLocaleDraftEditor(props: {
  readonly projectId: string;
  readonly listing: ProjectStoreListing;
  readonly onMutation: () => void;
}) {
  const [selected, setSelected] = useState(NEW_LOCALE);
  const [draft, setDraft] = useState<StoreListingLocale>(EMPTY_LOCALE);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);

  const options = [
    { value: NEW_LOCALE, label: 'New locale' },
    ...props.listing.locales.map((locale) => ({
      value: locale.locale,
      label: `${locale.locale} · ${locale.name}`,
    })),
  ];

  /*** Select one existing locale or reset the revision-scoped editor for a new locale. */
  const selectLocale = (value: string) => {
    setSelected(value);
    setError(null);
    setDraft(
      value === NEW_LOCALE
        ? EMPTY_LOCALE
        : (props.listing.locales.find((locale) => locale.locale === value) ?? EMPTY_LOCALE),
    );
  };

  /*** Persist the current locale value through Deploy's owner API. */
  const save = async () => {
    setBusy(true);
    setError(null);
    try {
      await writeProjectDeployListingLocale(props.projectId, draft);
      setSelected(draft.locale);
      props.onMutation();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : String(caught));
    } finally {
      setBusy(false);
    }
  };

  /*** Remove the selected locale through Deploy's lifecycle API without interpreting its fields. */
  const remove = async () => {
    if (selected === NEW_LOCALE) return;
    setConfirmDelete(false);
    setBusy(true);
    setError(null);
    try {
      await removeProjectDeployListingLocale(props.projectId, selected);
      setSelected(NEW_LOCALE);
      setDraft(EMPTY_LOCALE);
      props.onMutation();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : String(caught));
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <Field label="Locale entry">
        <Select value={selected} options={options} onValueChange={selectLocale} />
      </Field>
      <DeployOwnerAuthoringEditor
        structure={LOCALE_STRUCTURE}
        value={draft}
        policy={
          selected === NEW_LOCALE ? undefined : { fields: { locale: { readOnly: true } } }
        }
        onChange={setDraft}
        onError={setError}
      />
      {error ? <Text color="danger">{error}</Text> : null}
      <Button disabled={busy} onPress={() => void save()}>
        {busy ? 'Saving…' : 'Save locale'}
      </Button>
      {selected !== NEW_LOCALE ? (
        <Button disabled={busy} variant="outline" onPress={() => setConfirmDelete(true)}>
          Remove locale
        </Button>
      ) : null}
      <Dialog
        visible={confirmDelete}
        title="Remove store listing locale?"
        description={`Remove ${selected} through the Deploy owner API? Unrelated locales and assets remain owner-managed.`}
        onDismiss={() => setConfirmDelete(false)}
        footer={
          <View direction={{ base: 'column', md: 'row' }} gap="s" justify="flex-end">
            <Button
              color="neutral"
              variant="soft"
              disabled={busy}
              onPress={() => setConfirmDelete(false)}
            >
              Cancel
            </Button>
            <Button color="danger" disabled={busy} onPress={() => void remove()}>
              Remove locale
            </Button>
          </View>
        }
      />
    </>
  );
}
