import { SafeAreaView } from 'react-native-safe-area-context';
import { SemanticColors } from '../../src/theme/colors';
import { EvidenceGraphExplorer } from '../../src/components/shared/EvidenceGraphExplorer';

export default function EvidenceScreen() {
  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: SemanticColors.surfaceBackground }} edges={['top']}>
      <EvidenceGraphExplorer />
    </SafeAreaView>
  );
}
