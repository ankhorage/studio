import { isRecord, readOwnProperty } from '@ankhorage/utility/object';
import { expect, test } from 'bun:test';
import { createElement, isValidElement, type ReactNode } from 'react';

import type { AuthoringMutation, AuthoringNode } from '../../../../types/authoring-engine';
import { deriveAuthoringModel } from '../../application/use-cases/deriveAuthoringModel';
import type { AuthoringEditorProps } from './AuthoringEditor';

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

test('shows an inherited finite string choice and emits the selected owner value', () => {
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

test('preserves numeric finite-choice identity instead of coercing owner values to strings', () => {
  const mutations: AuthoringMutation[] = [];
  const model = deriveAuthoringModel({
    structure: {
      kind: 'object',
      fields: [
        {
          name: 'level',
          optional: true,
          structure: { kind: 'choice', values: [1, 2, 3] },
        },
      ],
    },
    value: { level: 2 },
  });
  const controls = renderControls(
    editor.AuthoringEditor({
      model,
      onMutation: (mutation) => mutations.push(mutation),
    }),
  );
  const select = controls.find((control) => control.type === 'Select');
  expect(select?.props.value).toBe('number:2');
  expect(select?.props.options).toEqual([
    { label: '1', value: 'number:1' },
    { label: '2', value: 'number:2' },
    { label: '3', value: 'number:3' },
  ]);
  const change = select?.props.onValueChange;
  if (typeof change !== 'function') throw new Error('Missing numeric choice handler.');
  Reflect.apply(change, undefined, ['number:3']);
  expect(mutations).toEqual([{ kind: 'set', path: ['level'], value: 3 }]);
});

test('renders finite set membership and emits canonical unordered membership', () => {
  const mutations: AuthoringMutation[] = [];
  const model = deriveAuthoringModel({
    structure: {
      kind: 'object',
      fields: [
        {
          name: 'permissions',
          optional: true,
          structure: {
            kind: 'set',
            member: { kind: 'choice', values: ['camera', 'microphone'] },
          },
        },
      ],
    },
    value: { permissions: { camera: true } },
  });
  const controls = renderControls(
    editor.AuthoringEditor({
      model,
      onMutation: (mutation) => mutations.push(mutation),
    }),
  );
  const switches = controls.filter((control) => control.type === 'Switch');
  expect(switches.map((control) => control.props.checked)).toEqual([true, false]);

  const addMicrophone = switches[1]?.props.onCheckedChange;
  if (typeof addMicrophone !== 'function') throw new Error('Missing membership change handler.');
  Reflect.apply(addMicrophone, undefined, [true]);
  expect(mutations.at(-1)).toEqual({
    kind: 'set',
    path: ['permissions'],
    value: { camera: true, microphone: true },
  });

  const removeCamera = switches[0]?.props.onCheckedChange;
  if (typeof removeCamera !== 'function') throw new Error('Missing membership removal handler.');
  Reflect.apply(removeCamera, undefined, [false]);
  expect(mutations.at(-1)).toEqual({ kind: 'unset', path: ['permissions'] });
});

test('renders ordered primitive choices and emits reorder, remove, and append mutations', () => {
  const mutations: AuthoringMutation[] = [];
  const model = deriveAuthoringModel({
    structure: {
      kind: 'object',
      fields: [
        {
          name: 'identifiers',
          optional: false,
          structure: {
            kind: 'ordered-list',
            item: { kind: 'choice', values: ['email', 'phone', 'username'] },
          },
        },
      ],
    },
    value: { identifiers: ['username', 'email'] },
  });
  const controls = renderControls(
    editor.AuthoringEditor({
      model,
      onMutation: (mutation) => mutations.push(mutation),
    }),
  );
  const buttons = controls.filter((control) => control.type === 'Button');

  const firstDown = buttons.find(
    (control) => control.props.children === 'Down' && control.props.disabled === false,
  )?.props.onPress;
  if (typeof firstDown !== 'function') throw new Error('Missing ordered-list down handler.');
  Reflect.apply(firstDown, undefined, []);
  expect(mutations.at(-1)).toEqual({
    kind: 'set',
    path: ['identifiers'],
    value: ['email', 'username'],
  });

  const firstRemove = buttons.find((control) => control.props.children === 'Remove')?.props.onPress;
  if (typeof firstRemove !== 'function') throw new Error('Missing ordered-list remove handler.');
  Reflect.apply(firstRemove, undefined, []);
  expect(mutations.at(-1)).toEqual({
    kind: 'set',
    path: ['identifiers'],
    value: ['email'],
  });

  const addPhone = buttons.find((control) => control.props.children === 'Add phone')?.props.onPress;
  if (typeof addPhone !== 'function') throw new Error('Missing ordered-list append handler.');
  Reflect.apply(addPhone, undefined, []);
  expect(mutations.at(-1)).toEqual({
    kind: 'set',
    path: ['identifiers'],
    value: ['username', 'email', 'phone'],
  });
});

test('edits and appends open ordered string items without a finite choice catalog', () => {
  const mutations: AuthoringMutation[] = [];
  const model = deriveAuthoringModel({
    structure: {
      kind: 'object',
      fields: [
        {
          name: 'fields',
          optional: false,
          structure: {
            kind: 'ordered-list',
            item: { kind: 'scalar', scalarType: 'string' },
          },
        },
      ],
    },
    value: { fields: ['email', 'customField'] },
  });
  const controls = renderControls(
    editor.AuthoringEditor({
      model,
      onMutation: (mutation) => mutations.push(mutation),
    }),
  );

  const inputs = controls.filter((control) => control.type === 'TextInput');
  expect(inputs.map((control) => control.props.value)).toEqual(['email', 'customField']);

  const editSecond = inputs[1]?.props.onChangeText;
  if (typeof editSecond !== 'function') throw new Error('Missing ordered string edit handler.');
  Reflect.apply(editSecond, undefined, ['displayName']);
  expect(mutations.at(-1)).toEqual({
    kind: 'set',
    path: ['fields'],
    value: ['email', 'displayName'],
  });

  const addItem = controls.find(
    (control) => control.type === 'Button' && control.props.children === 'Add item',
  )?.props.onPress;
  if (typeof addItem !== 'function') throw new Error('Missing ordered string append handler.');
  Reflect.apply(addItem, undefined, []);
  expect(mutations.at(-1)).toEqual({
    kind: 'set',
    path: ['fields'],
    value: ['email', 'customField', ''],
  });
});

test('renders open value maps and emits rename, update, remove, and add mutations', () => {
  const mutations: AuthoringMutation[] = [];
  const model = deriveAuthoringModel({
    structure: {
      kind: 'object',
      fields: [
        {
          name: 'spacing',
          optional: true,
          structure: {
            kind: 'value-map',
            key: { kind: 'scalar', scalarType: 'string' },
            value: { kind: 'scalar', scalarType: 'number' },
          },
        },
      ],
    },
    value: { spacing: { m: 16 } },
  });
  const controls = renderControls(
    editor.AuthoringEditor({
      model,
      onMutation: (mutation) => mutations.push(mutation),
    }),
  );

  const inputs = controls.filter((control) => control.type === 'TextInput');
  const keyInput = inputs.find((control) => control.props.defaultValue === 'm');
  const valueInput = inputs.find((control) => control.props.value === '16');

  const rename = keyInput?.props.onEndEditing;
  if (typeof rename !== 'function') throw new Error('Missing value-map rename handler.');
  Reflect.apply(rename, undefined, [{ nativeEvent: { text: 'medium' } }]);
  expect(mutations.at(-1)).toEqual({
    kind: 'rename-key',
    path: ['spacing'],
    fromKey: 'm',
    toKey: 'medium',
  });

  const update = valueInput?.props.onChangeText;
  if (typeof update !== 'function') throw new Error('Missing value-map value handler.');
  Reflect.apply(update, undefined, ['20']);
  expect(mutations.at(-1)).toEqual({
    kind: 'set',
    path: ['spacing', 'm'],
    value: 20,
  });

  const remove = controls.find(
    (control) => control.type === 'Button' && control.props.children === 'Remove',
  )?.props.onPress;
  if (typeof remove !== 'function') throw new Error('Missing value-map remove handler.');
  Reflect.apply(remove, undefined, []);
  expect(mutations.at(-1)).toEqual({ kind: 'unset', path: ['spacing'] });

  const add = controls.find(
    (control) => control.type === 'Button' && control.props.children === 'Add entry',
  )?.props.onPress;
  if (typeof add !== 'function') throw new Error('Missing value-map add handler.');
  Reflect.apply(add, undefined, []);
  expect(mutations.at(-1)).toEqual({
    kind: 'set',
    path: ['spacing', 'newKey'],
    value: 0,
  });
});

test('adds object-valued map entries when every nested field is optional', () => {
  const mutations: AuthoringMutation[] = [];
  const model = deriveAuthoringModel({
    structure: {
      kind: 'object',
      fields: [
        {
          name: 'headings',
          optional: true,
          structure: {
            kind: 'value-map',
            key: { kind: 'scalar', scalarType: 'string' },
            value: {
              kind: 'object',
              fields: [
                {
                  name: 'size',
                  optional: true,
                  structure: { kind: 'scalar', scalarType: 'number' },
                },
              ],
            },
          },
        },
      ],
    },
    value: { headings: {} },
  });
  const controls = renderControls(
    editor.AuthoringEditor({
      model,
      onMutation: (mutation) => mutations.push(mutation),
    }),
  );

  const add = controls.find(
    (control) => control.type === 'Button' && control.props.children === 'Add entry',
  )?.props.onPress;
  if (typeof add !== 'function') throw new Error('Missing object value-map add handler.');
  Reflect.apply(add, undefined, []);

  expect(mutations.at(-1)).toEqual({
    kind: 'set',
    path: ['headings', 'newKey'],
    value: {},
  });
});

test('renders inherited value-map entries without emitting authored state', () => {
  const mutations: AuthoringMutation[] = [];
  const model = deriveAuthoringModel({
    structure: {
      kind: 'object',
      fields: [
        {
          name: 'spacing',
          optional: true,
          structure: {
            kind: 'value-map',
            key: { kind: 'scalar', scalarType: 'string' },
            value: { kind: 'scalar', scalarType: 'number' },
          },
        },
      ],
    },
    value: {},
    policy: {
      fields: {
        spacing: {
          fields: {
            m: { inheritance: { value: 16 } },
          },
        },
      },
    },
  });
  const controls = renderControls(
    editor.AuthoringEditor({
      model,
      onMutation: (mutation) => mutations.push(mutation),
    }),
  );

  const inheritedKey = controls.find(
    (control) => control.type === 'TextInput' && control.props.defaultValue === 'm',
  );
  expect(inheritedKey?.props.readOnly).toBe(true);
  expect(
    controls.some((control) => control.type === 'TextInput' && control.props.value === '16'),
  ).toBe(true);
  expect(
    controls.some((control) => control.type === 'Button' && control.props.children === 'Remove'),
  ).toBe(false);
  expect(mutations).toEqual([]);
});

test('captures open registry identity before insertion and keeps existing identity immutable', () => {
  const mutations: AuthoringMutation[] = [];
  const model = deriveAuthoringModel({
    structure: {
      kind: 'object',
      fields: [
        {
          name: 'products',
          optional: false,
          structure: {
            kind: 'entity-registry',
            key: { kind: 'scalar', scalarType: 'string' },
            identityField: 'id',
            value: {
              kind: 'object',
              fields: [
                {
                  name: 'id',
                  optional: false,
                  structure: { kind: 'scalar', scalarType: 'string' },
                },
                {
                  name: 'name',
                  optional: false,
                  structure: { kind: 'scalar', scalarType: 'string' },
                },
              ],
            },
          },
        },
      ],
    },
    value: { products: { alpha: { id: 'alpha', name: 'Alpha' } } },
  });
  const controls = renderControls(
    editor.AuthoringEditor({
      model,
      onMutation: (mutation) => mutations.push(mutation),
    }),
  );

  expect(
    controls.some(
      (control) => control.type === 'TextInput' && control.props.defaultValue === 'alpha',
    ),
  ).toBe(false);

  const remove = controls.find(
    (control) => control.type === 'Button' && control.props.children === 'Remove',
  )?.props.onPress;
  if (typeof remove !== 'function') throw new Error('Missing entity removal handler.');
  Reflect.apply(remove, undefined, []);
  expect(mutations.at(-1)).toEqual({ kind: 'unset', path: ['products', 'alpha'] });

  const identityInput = controls.find(
    (control) => control.type === 'TextInput' && control.props.placeholder === 'Entity identity',
  );
  const changeIdentity = identityInput?.props.onChangeText;
  const add = controls.find(
    (control) => control.type === 'Button' && control.props.children === 'Add entity',
  )?.props.onPress;
  if (typeof changeIdentity !== 'function' || typeof add !== 'function') {
    throw new Error('Missing open registry insertion controls.');
  }

  const beforeInvalid = mutations.length;
  Reflect.apply(add, undefined, []);
  Reflect.apply(changeIdentity, undefined, ['alpha']);
  Reflect.apply(add, undefined, []);
  expect(mutations).toHaveLength(beforeInvalid);

  Reflect.apply(changeIdentity, undefined, [' beta ']);
  Reflect.apply(add, undefined, []);
  expect(mutations.at(-1)).toEqual({
    kind: 'set',
    path: ['products', 'beta'],
    value: { id: 'beta', name: '' },
  });
});

test('renders discriminated union selection and initializes the selected owner variant', () => {
  const mutations: AuthoringMutation[] = [];
  const model = deriveAuthoringModel({
    structure: {
      kind: 'object',
      fields: [
        {
          name: 'rollout',
          optional: true,
          structure: {
            kind: 'union',
            discriminator: 'mode',
            variants: [
              {
                kind: 'object',
                fields: [
                  {
                    name: 'mode',
                    optional: false,
                    structure: { kind: 'choice', values: ['immediate'] },
                  },
                ],
              },
              {
                kind: 'object',
                fields: [
                  {
                    name: 'mode',
                    optional: false,
                    structure: { kind: 'choice', values: ['staged'] },
                  },
                  {
                    name: 'fraction',
                    optional: false,
                    structure: { kind: 'scalar', scalarType: 'string' },
                  },
                ],
              },
            ],
          },
        },
      ],
    },
    value: { rollout: { mode: 'immediate' } },
  });
  const controls = renderControls(
    editor.AuthoringEditor({
      model,
      onMutation: (mutation) => mutations.push(mutation),
    }),
  );
  const select = controls.find((control) => control.type === 'Select');
  expect(select?.props.options).toEqual([
    { label: 'immediate', value: 'string:"immediate"' },
    { label: 'staged', value: 'string:"staged"' },
  ]);

  const selectStaged = select?.props.onValueChange;
  if (typeof selectStaged !== 'function') throw new Error('Missing union variant handler.');
  Reflect.apply(selectStaged, undefined, ['string:"staged"']);
  expect(mutations.at(-1)).toEqual({
    kind: 'set',
    path: ['rollout'],
    value: { mode: 'staged', fraction: '' },
  });
});

test('delegates owner-requested custom controls while retaining the central Field wrapper', () => {
  const mutations: AuthoringMutation[] = [];
  const model = deriveAuthoringModel({
    structure: {
      kind: 'object',
      fields: [
        {
          name: 'source',
          optional: true,
          structure: {
            kind: 'object',
            fields: [
              {
                name: 'mediaId',
                optional: true,
                structure: { kind: 'scalar', scalarType: 'string' },
              },
            ],
          },
        },
      ],
    },
    value: { source: { mediaId: 'hero' } },
    policy: {
      fields: {
        source: { label: 'Source', editor: { kind: 'media', mediaKinds: ['image'] } },
      },
    },
  });
  const controls = renderControls(
    editor.AuthoringEditor({
      model,
      onMutation: (mutation) => mutations.push(mutation),
      renderCustomControl: ({ model: field, onMutation }) =>
        field.editor?.kind === 'media'
          ? createElement('span', {
              onClick: () =>
                onMutation({ kind: 'set', path: field.path, value: { mediaId: 'replacement' } }),
            })
          : undefined,
    }),
  );
  expect(controls.some((control) => control.type === 'Field')).toBe(true);
  const custom = controls.find((control) => control.type === 'span');
  const click = custom?.props.onClick;
  if (typeof click !== 'function') throw new Error('Missing custom editor handler.');
  Reflect.apply(click, undefined, []);
  expect(mutations).toEqual([{ kind: 'set', path: ['source'], value: { mediaId: 'replacement' } }]);
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
  AuthoringEditor: (props: AuthoringEditorProps) => ReactNode;
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
