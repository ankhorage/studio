import { StyleSheet } from 'react-native';

export const generatedApiEditorStyles = StyleSheet.create({
  actions: {
    alignItems: 'center',
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  bordered: {
    borderColor: '#64748b',
    borderRadius: 8,
    borderWidth: 1,
    gap: 12,
    padding: 12,
  },
  columns: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  field: {
    flexGrow: 1,
    gap: 6,
    minWidth: 190,
  },
  stack: {
    gap: 12,
  },
  toggle: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 6,
  },
});
