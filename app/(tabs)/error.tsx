import { useEffect } from 'react';
import { View, Text, StyleSheet, Pressable } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useTranslation } from 'react-i18next';
import { DK } from '../../src/theme/draftkings';
import { TYPE, GRID, RADIUS } from '../../src/theme/tabStyles';
import { captureException } from '../../src/lib/errorReporting';

interface Props { error: Error; retry: () => void; }

export default function RouteErrorScreen({ error, retry }: Props) {
  const { t } = useTranslation();
  useEffect(() => { captureException(error); }, [error]);
  return (
    <SafeAreaView style={s.root}>
      <View style={s.center}>
        <Ionicons name="alert-circle" size={36} color={DK.colors.accent} />
        <Text style={s.title}>{t('error.somethingWrong', 'SOMETHING WENT WRONG')}</Text>
        <Text style={s.body}>{t('error.body', 'A screen failed to render. Try again.')}</Text>
        <Pressable style={s.btn} onPress={retry} accessibilityRole="button">
          <Text style={s.btnText}>{t('error.retry', 'TRY AGAIN').toUpperCase()}</Text>
        </Pressable>
      </View>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: DK.colors.bg },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: GRID.lg, gap: GRID.md },
  title: { color: DK.colors.text, fontFamily: TYPE.titleFamily, fontSize: 14, letterSpacing: 1.4 },
  body: { color: DK.colors.textMuted, fontFamily: TYPE.bodyFamily, fontSize: 13, textAlign: 'center', maxWidth: 300 },
  btn: { backgroundColor: DK.colors.accent, paddingHorizontal: GRID.xl, paddingVertical: GRID.md, borderRadius: RADIUS.full, marginTop: GRID.md },
  btnText: { color: '#000', fontFamily: TYPE.titleFamily, fontSize: 13, letterSpacing: 1.4 },
});
