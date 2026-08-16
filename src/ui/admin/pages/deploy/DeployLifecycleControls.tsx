import type { ReleaseLifecycleControl } from '@ankhorage/deploy';
import { Button, Text } from '@ankhorage/zora';
import React from 'react';
import { View } from 'react-native';

export function DeployLifecycleControls(props: {
  readonly controls: readonly ReleaseLifecycleControl[];
  readonly disabled: boolean;
  readonly onControl: (control: ReleaseLifecycleControl) => void;
}) {
  if (props.controls.length === 0) return null;
  return (
    <View>
      <Text weight="semiBold">Available lifecycle controls</Text>
      {props.controls.map((control) => (
        <Button
          key={`${control.target}:${control.action}`}
          disabled={props.disabled}
          variant="outline"
          onPress={() => props.onControl(control)}
        >
          {control.target}: {control.action}
        </Button>
      ))}
    </View>
  );
}
