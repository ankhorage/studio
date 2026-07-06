import { Icon, Text } from '@ankhorage/zora';
import React from 'react';
import { StyleSheet, View } from 'react-native';

export function DashboardSectionHeader(props: { icon: string; title: string }) {
  return (
    <View style={styles.row}>
      <Icon name={props.icon} size={16} color="textSecondary" />
      <Text color="neutral" emphasis="muted" variant="eyebrow">
        {props.title}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 12,
    marginLeft: 8,
  },
});
