import { Text } from '@ankhorage/zora';
import { Switch, View } from 'react-native';

import { generatedApiEditorStyles } from './generatedApiEditorStyles';

export function GeneratedApiToggle({
  label,
  value,
  onValueChange,
}: {
  readonly label: string;
  readonly value: boolean;
  readonly onValueChange: (value: boolean) => void;
}) {
  return (
    <View style={generatedApiEditorStyles.toggle}>
      <Switch value={value} onValueChange={onValueChange} />
      <Text variant="bodySmall">{label}</Text>
    </View>
  );
}
