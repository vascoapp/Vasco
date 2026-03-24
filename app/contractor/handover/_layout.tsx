import { Stack } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { SemanticColors } from '../../../src/theme/colors';

export default function HandoverLayout() {
  const { t } = useTranslation();
  return (
    <Stack
      screenOptions={{
        headerStyle: {
          backgroundColor: SemanticColors.surfacePrimary,
        },
        headerTintColor: SemanticColors.textPrimary,
        headerTitleStyle: {
          fontWeight: '600',
        },
        headerShadowVisible: false,
      }}
    >
      <Stack.Screen
        name="[jobId]"
        options={{
          title: t('handover.title', 'Handover Package'),
          headerBackTitle: t('common.back', 'Back'),
        }}
      />
    </Stack>
  );
}
