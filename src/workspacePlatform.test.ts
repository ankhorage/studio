import { expect, test } from 'bun:test';

import { createDeleteConfirmation, type DeleteConfirmationButton } from './workspacePlatform';

test('web delete cancellation does not fall through to native alert', () => {
  let confirmed = false;
  let alerted = false;
  const confirmDelete = createDeleteConfirmation({
    isWeb: true,
    confirm: () => false,
    alert: () => {
      alerted = true;
    },
  });

  confirmDelete('Release Monitor', () => {
    confirmed = true;
  });

  expect(confirmed).toBe(false);
  expect(alerted).toBe(false);
});

test('web delete confirmation runs the destructive action without native alert', () => {
  let confirmed = false;
  let alerted = false;
  const confirmDelete = createDeleteConfirmation({
    isWeb: true,
    confirm: () => true,
    alert: () => {
      alerted = true;
    },
  });

  confirmDelete('Release Monitor', () => {
    confirmed = true;
  });

  expect(confirmed).toBe(true);
  expect(alerted).toBe(false);
});

test('native delete confirmation only runs after destructive alert action', () => {
  let confirmed = false;
  let buttons: DeleteConfirmationButton[] = [];
  const confirmDelete = createDeleteConfirmation({
    isWeb: false,
    alert: (_title, _message, nextButtons) => {
      buttons = nextButtons ?? [];
    },
  });

  confirmDelete('Release Monitor', () => {
    confirmed = true;
  });

  expect(confirmed).toBe(false);
  expect(buttons).toHaveLength(2);

  const destructive = buttons.find((button) => button.style === 'destructive');
  destructive?.onPress?.();

  expect(confirmed).toBe(true);
});
