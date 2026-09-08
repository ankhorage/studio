import { expect, test } from 'bun:test';
import path from 'path';

const pageSource = await Bun.file(path.join(import.meta.dir, 'BindingsAdminPage.tsx')).text();
const propertyCardSource = await Bun.file(
  path.join(import.meta.dir, 'bindings/PropertyBindingsCard.tsx'),
).text();
const eventCardSource = await Bun.file(
  path.join(import.meta.dir, 'bindings/EventBindingsCard.tsx'),
).text();

test('passes the composed bindable component metadata into both binding cards', () => {
  expect(pageSource.match(/componentMeta={studio\.bindableComponentMeta}/g)).toHaveLength(2);
  expect(propertyCardSource).toContain('props.componentMeta');
  expect(eventCardSource).toContain('props.componentMeta');
  expect(propertyCardSource).not.toContain('ZORA_BINDABLE_COMPONENT_META');
  expect(eventCardSource).not.toContain('ZORA_BINDABLE_COMPONENT_META');
});
