import { View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { WarrantyManager } from '../../src/components/contractor';
// The component drew its own title bar, but that bar had no back control — and
// its magnifying-glass Pressable had no onPress, so it was a button that could
// never do anything. DKScreenHeader replaces the title; the dead search icon is
// gone with it.
import { DKScreenHeader } from '../../src/components/shared/DKScreenHeader';
import { PAGE_BG } from '../../src/theme/tabStyles';

export default function WarrantyScreen() {
  const { t } = useTranslation();
  return (
    <View style={{ flex: 1, backgroundColor: PAGE_BG }}>
      <DKScreenHeader title={t('warranty.title', 'Warranty management')} />
      <WarrantyManager />
    </View>
  );
}
