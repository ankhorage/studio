import { Icon, Text } from '@ankhorage/zora';
import React from 'react';
import { StyleSheet, TouchableOpacity, View } from 'react-native';

import type { TemplateEntry } from '../types';

function formatCategory(category: string): string {
  return category
    .split('_')
    .map((part) => `${part.charAt(0).toUpperCase()}${part.slice(1)}`)
    .join(' ');
}

export function TemplateCard(props: {
  template: TemplateEntry;
  disabled: boolean;
  mode: 'light' | 'dark';
  borderColor: string;
  onPress: () => void;
}) {
  const { template } = props;

  return (
    <TouchableOpacity
      key={template.id}
      onPress={props.onPress}
      disabled={props.disabled}
      style={{ opacity: props.disabled ? 0.5 : 1 }}
    >
      <View
        style={{
          width: 180,
          overflow: 'hidden',
          borderWidth: 1,
          borderColor: props.borderColor,
          borderRadius: 12,
        }}
      >
        <View
          style={{
            height: 100,
            alignItems: 'center',
            justifyContent: 'center',
            backgroundColor: props.mode === 'dark' ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.05)',
          }}
        >
          <Icon name="add" size={48} color="text" />
        </View>

        <View style={styles.body}>
          <Text color="neutral" emphasis="muted" variant="caption">
            {formatCategory(template.category)}
          </Text>
          <Text variant="bodySmall" weight="semiBold">
            {template.name}
          </Text>
          <Text color="neutral" emphasis="muted" variant="caption">
            {template.description}
          </Text>
          <Text color="neutral" emphasis="muted" variant="caption">
            Template v{template.version}
          </Text>
        </View>
      </View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  body: {
    padding: 16,
    gap: 4,
  },
});
