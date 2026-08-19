import { View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { CashFlowDashboard } from '../../src/components/contractor';
// See ai-assistant.tsx: routed bare, so the screen opened with no title and no
// back control.
import { DKScreenHeader } from '../../src/components/shared/DKScreenHeader';
import { PAGE_BG } from '../../src/theme/tabStyles';

export default function CashFlowScreen() {
  const { t } = useTranslation();
  return (
    <View style={{ flex: 1, backgroundColor: PAGE_BG }}>
      <DKScreenHeader title={t('cashflow.title', 'Cash flow')} />
      <CashFlowDashboard />
    </View>
  );
}
