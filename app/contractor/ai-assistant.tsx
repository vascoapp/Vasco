import { View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { AIAssistant } from '../../src/components/contractor';
// The component renders a view selector and nothing above it, so as a routed
// screen it had no title and — with headerShown:false on this stack — no way
// back at all. Every other drill-down uses DKScreenHeader; this one was pushed
// bare.
import { DKScreenHeader } from '../../src/components/shared/DKScreenHeader';
import { PAGE_BG } from '../../src/theme/tabStyles';

export default function AIAssistantScreen() {
  const { t } = useTranslation();
  return (
    <View style={{ flex: 1, backgroundColor: PAGE_BG }}>
      <DKScreenHeader title={t('aiAssistant.title', 'AI assistant')} />
      <AIAssistant />
    </View>
  );
}
