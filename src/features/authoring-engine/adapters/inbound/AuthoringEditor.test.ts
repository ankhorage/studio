import { expect, test } from 'bun:test';
import type { ReactNode } from 'react';
import { isValidElement } from 'react';

import type { AuthoringMutation, AuthoringNode } from '../../../../types/authoring-engine';
import { deriveAuthoringModel } from '../../application/use-cases/deriveAuthoringModel';

// Bundle only this adapter against inert control contracts; no global module mocks or native runtime.
const editor = await loadEditor();

test('renders inherited boolean defaults and emits explicit false without materializing defaults', () => {
  const mutations: AuthoringMutation[] = [];
  const controls = renderControls(
    editor.AuthoringEditor({
      model: booleanModel(undefined),
      onMutation: (mutation) => mutations.push(mutation),
    }),
  );
  const toggle = controls.find((control) => control.type === 'Switch');
  expect(toggle?.props.checked).toBe(true);
  expect(controls.find((control) => control.type === 'Button')?.props.disabled).toBe(true);
  expect(mutations).toEqual([]);
  const change = toggle?.props.onCheckedChange;
  if (typeof change !== 'function') throw new Error('Missing boolean change handler.');
  Reflect.apply(change, undefined, [false]);
  expect(mutations).toEqual([{ kind: 'set', path: ['enabled'], value: false }]);
});

test('resets an explicit boolean override through an unset mutation', () => {
  const mutations: AuthoringMutation[] = [];
  const controls = renderControls(
    editor.AuthoringEditor({
      model: booleanModel(false),
      onMutation: (mutation) => mutations.push(mutation),
    }),
  );
  expect(controls.find((control) => control.type === 'Switch')?.props.checked).toBe(false);
  const reset = controls.find((control) => control.type === 'Button');
  expect(reset?.props.disabled).toBe(false);
  const press = reset?.props.onPress;
  if (typeof press !== 'function') throw new Error('Missing inheritance reset handler.');
  Reflect.apply(press, undefined, []);
  expect(mutations).toEqual([{ kind: 'unset', path: ['enabled'] }]);
});

test('keeps invalid overrides resettable and read-only fields immutable', () => {
  for (const readOnly of [false, true]) {
    const model = booleanModel('invalid', readOnly);
    const controls = renderControls(
      editor.AuthoringEditor({
        model,
        onMutation: () => {
          throw new Error('Rendering must not mutate authoring state.');
        },
      }),
    );
    expect(controls.some((control) => control.type === 'Switch')).toBe(false);
    expect(controls.some((control) => control.type === 'Button')).toBe(!readOnly);
  }
});

test('shows an inherited finite choice and emits the selected owner value', () => {
  const mutations: AuthoringMutation[] = [];
  const model = deriveAuthoringModel({
    structure: {
      kind: 'object',
      fields: [
        {
          name: 'tone',
          optional: true,
          structure: { kind: 'choice', values: ['default', 'subtle'] },
        },
      ],
    },
    value: {},
    policy: { fields: { tone: { inheritance: { value: 'default' } } } },
  });
  const controls = renderControls(
    editor.AuthoringEditor({
      model,
      onMutation: (mutation) => mutations.push(mutation),
    }),
  );
  const select = controls.find((control) => control.type === 'Select');
  expect(select?.props.value).toBe('default');
  expect(select?.props.options).toEqual([
    { label: 'default', value: 'default' },
    { label: 'subtle', value: 'subtle' },
  ]);
  const change = select?.props.onValueChange;
  if (typeof change !== 'function') throw new Error('Missing choice change handler.');
  Reflect.apply(change, undefined, ['subtle']);
  expect(mutations).toEqual([{ kind: 'set', path: ['tone'], value: 'subtle' }]);
});

function booleanModel(value: unknown, readOnly = false): AuthoringNode {
  return deriveAuthoringModel({
    structure: {
      kind: 'object',
      fields: [
        { name: 'enabled', optional: true, structure: { kind: 'scalar', scalarType: 'boolean' } },
      ],
    },
    value: { enabled: value },
    policy: { fields: { enabled: { inheritance: { value: true }, readOnly } } },
  });
}

function renderControls(node: unknown): readonly {
  readonly type: string;
  readonly props: Record<string, unknown>;
}[] {
  if (Array.isArray(node)) return node.flatMap(renderControls);
  if (!isValidElement<Record<string, unknown>>(node)) return [];
  if (typeof node.type === 'function') {
    const rendered: unknown = Reflect.apply(node.type, undefined, [node.props]);
    return renderControls(rendered);
  }
  const children = renderControls(node.props.children);
  return typeof node.type === 'string'
    ? [{ type: node.type, props: node.props }, ...children]
    : children;
}

async function loadEditor(): Promise<{
  AuthoringEditor: (props: {
    model: AuthoringNode;
    onMutation: (mutation: AuthoringMutation) => void;
  }) => ReactNode;
}> {
  const build = await Bun.build({
    entrypoints: [new URL('./AuthoringEditor.tsx', import.meta.url).pathname],
    target: 'bun',
    plugins: [
      {
        name: 'inert-authoring-controls',
        setup(builder) {
          builder.onResolve({ filter: /^(@ankhorage\/zora|react-native)$/u }, ({ path }) => ({
            path,
            namespace: 'inert-controls',
          }));
          builder.onLoad({ filter: /.*/u, namespace: 'inert-controls' }, () => ({
            loader: 'js',
            contents: `export const Button='Button', Field='Field', Select='Select',
          Switch='Switch', Text='Text', TextInput='TextInput', View='View';
          export const StyleSheet={create: value => value};`,
          }));
        },
      },
    ],
  });
  if (!build.success || !build.outputs[0])
    throw new Error(build.logs.map((log) => log.message).join('\n'));
  const loaded: unknown = await import(
    `data:text/javascript;base64,${Buffer.from(await build.outputs[0].text()).toString('base64')}`
  );
  const component = isRecord(loaded) ? readOwnProperty(loaded, 'AuthoringEditor') : undefined;
  if (typeof component !== 'function') throw new Error('Missing bundled AuthoringEditor.');
  return {
    AuthoringEditor(props) {
      const rendered: unknown = Reflect.apply(component, undefined, [props]);
      if (!isValidElement(rendered)) throw new Error('Expected an authoring React element.');
      return rendered;
    },
  };
}
import { isRecord, readOwnProperty } from '@ankhorage/utility/object';
