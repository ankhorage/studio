import { StyleSheet } from 'react-native';

export const bindingAdminStyles = StyleSheet.create({
  stack: {
    gap: 12,
  },
  compactStack: {
    gap: 8,
  },
  row: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    alignItems: 'flex-end',
  },
  grow: {
    flexGrow: 1,
    flexBasis: 220,
  },
  actions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  divider: {
    height: 1,
    backgroundColor: 'rgba(127, 127, 127, 0.2)',
  },
});
