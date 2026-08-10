import { Card, Text } from '@ankhorage/zora';
import { View } from 'react-native';

import type { StudioBindingDiagnostic } from '../../../../bindingAuthoringModel';
import { bindingAdminStyles } from './bindingAdminStyles';

export function BindingDiagnosticsCard(props: {
  readonly diagnostics: readonly StudioBindingDiagnostic[];
}) {
  return (
    <Card title="Binding diagnostics">
      <View style={bindingAdminStyles.compactStack}>
        {props.diagnostics.length === 0 ? (
          <Text color="success" variant="bodySmall">
            No binding diagnostics for this component.
          </Text>
        ) : (
          props.diagnostics.map((diagnostic, index) => (
            <View key={`${diagnostic.code}:${diagnostic.path ?? index}`}>
              <Text color={diagnostic.severity === 'error' ? 'danger' : 'warning'} variant="bodySmall">
                {diagnostic.message}
              </Text>
              {diagnostic.path ? (
                <Text color="neutral" emphasis="muted" variant="bodySmall">
                  {diagnostic.path}
                </Text>
              ) : null}
            </View>
          ))
        )}
      </View>
    </Card>
  );
}
