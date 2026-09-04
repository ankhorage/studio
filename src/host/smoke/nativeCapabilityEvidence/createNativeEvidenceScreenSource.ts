/*** Create the generated React Native screen source that displays redacted native capability evidence.
 * @todo Move this acceptance-fixture source generator from src/host/smoke to test/smoke/nativeCapabilityEvidence.
 */
export function createNativeEvidenceScreenSource(): string {
  return `import { Stack } from 'expo-router';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { useNativeEvidenceController } from '@/native-evidence/native-evidence-controller';

const screenOptions = { title: 'Native evidence' };
type Controller = ReturnType<typeof useNativeEvidenceController>;

export function NativeEvidenceScreen() {
  const controller = useNativeEvidenceController();
  return <NativeEvidenceContent controller={controller} />;
}

function NativeEvidenceContent({ controller }: { readonly controller: Controller }) {
  return (
    <ScrollView contentContainerStyle={styles.content} contentInsetAdjustmentBehavior="automatic">
      <Stack.Screen options={screenOptions} />
      <Text selectable style={styles.title}>
        Expo 57 native evidence
      </Text>
      <ScenarioStatus controller={controller} />
      <ResultCard result={controller.result} />
      <RunButton controller={controller} />
      <Text selectable style={styles.note}>
        Results contain status only. Tokens, authorization payloads, selected file names and media
        bytes are never displayed or reported.
      </Text>
    </ScrollView>
  );
}

function ResultCard({ result }: { readonly result: string }) {
  return (
    <View style={styles.resultCard}>
      <Text selectable style={styles.result} testID="native-evidence-result">
        {result}
      </Text>
    </View>
  );
}

function RunButton({ controller }: { readonly controller: Controller }) {
  return (
    <Pressable
      accessibilityRole="button"
      disabled={controller.running}
      onPress={() => void controller.runScenarioAsync()}
      style={[styles.button, controller.running && styles.buttonDisabled]}
      testID="native-evidence-run"
    >
      <Text style={styles.buttonLabel}>{controller.running ? 'Running…' : 'Run scenario'}</Text>
    </Pressable>
  );
}

function ScenarioStatus({ controller }: { readonly controller: Controller }) {
  return (
    <>
      <Text selectable style={styles.body} testID="native-evidence-scenario">
        Scenario: {controller.scenario}
      </Text>
      {controller.permission ? (
        <Text selectable style={styles.body} testID="native-evidence-permission">
          Permission: {controller.permission}
        </Text>
      ) : null}
    </>
  );
}

const styles = StyleSheet.create({
  body: { color: '#374151', fontSize: 15 },
  button: {
    alignItems: 'center',
    backgroundColor: '#2563eb',
    borderCurve: 'continuous',
    borderRadius: 12,
    paddingHorizontal: 18,
    paddingVertical: 13,
  },
  buttonDisabled: { opacity: 0.55 },
  buttonLabel: { color: '#ffffff', fontSize: 16, fontWeight: '600' },
  content: { gap: 14, padding: 20 },
  note: { color: '#6b7280', fontSize: 13, lineHeight: 18 },
  result: { color: '#111827', fontSize: 15, lineHeight: 21 },
  resultCard: {
    backgroundColor: '#f3f4f6',
    borderCurve: 'continuous',
    borderRadius: 14,
    padding: 16,
  },
  title: { color: '#111827', fontSize: 24, fontWeight: '700' },
});
`;
}
