// =============================================================================
// JOB PHOTO GALLERY
// =============================================================================
// Lists every photo uploaded for a job, lets the contractor tag a kind
// (before/during/after/defect/handover) and delete stale ones.
// =============================================================================

import { useEffect, useState, useCallback } from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable, Image, ActivityIndicator, Alert } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { SafeArea } from '../../../../src/theme/spacing';
import { SemanticColors, Palette } from '../../../../src/theme/colors';
import { PAGE_BG, TYPE, RADIUS, GRID } from '../../../../src/theme/tabStyles';
import { listJobPhotos, uploadJobPhoto, deleteJobPhoto, type JobPhotoRecord, type PhotoKind } from '../../../../src/services/jobPhotoService';
import { hapticSuccess } from '../../../../src/utils/haptics';

const KINDS: PhotoKind[] = ['before', 'during', 'after', 'defect', 'handover'];

export default function JobPhotosScreen() {
  const { t } = useTranslation();
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const [photos, setPhotos] = useState<JobPhotoRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);

  // R12.1: localized labels for the 5 photo kinds. Was rendering raw enum
  // values ('before', 'during', 'after', 'defect', 'handover') in English
  // even on Dutch/German/etc devices.
  const KIND_LABELS: Record<PhotoKind, string> = {
    before: t('jobs.photos.before', 'Before'),
    during: t('jobs.photos.during', 'During'),
    after: t('jobs.photos.after', 'After'),
    defect: t('jobs.photos.defect', 'Defect'),
    handover: t('jobs.photos.handover', 'Handover'),
  };

  const refresh = useCallback(async () => {
    if (!id) return;
    setLoading(true);
    const list = await listJobPhotos(String(id));
    // R66 round 27: merge in pending offline-queued photos so the
    // contractor sees them immediately (with a local file:// preview)
    // instead of "where did my photo go?". Queued photos use a synthetic
    // pp-* id; the next flushQueue tick replaces them with the real BE row.
    try {
      const { listPendingForJob } = await import('../../../../src/services/pendingJobPhotosQueue');
      const pending = await listPendingForJob(String(id));
      const pendingAsRecords: JobPhotoRecord[] = pending.map((p) => ({
        id: p.id,
        jobId: p.jobId,
        storagePath: p.fileUri,
        publicUrl: p.fileUri,
        kind: p.kind,
        caption: p.caption,
        takenAt: p.queuedAt,
      }));
      // Pending first (newest) then server list. Filter dupes by id.
      const seen = new Set(pendingAsRecords.map((p) => p.id));
      const merged = [
        ...pendingAsRecords,
        ...list.filter((p) => !seen.has(p.id)),
      ];
      setPhotos(merged);
    } catch {
      setPhotos(list);
    }
    setLoading(false);
  }, [id]);

  useEffect(() => { refresh(); }, [refresh]);

  const handlePick = async (kind: PhotoKind) => {
    const result = await ImagePicker.launchCameraAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      quality: 0.7,
      base64: true,
    });
    if (result.canceled || !result.assets?.[0]?.base64) return;
    setUploading(true);
    const upload = await uploadJobPhoto({ jobId: String(id), imageBase64: result.assets[0].base64, kind });
    setUploading(false);
    if (upload) {
      hapticSuccess();
      await refresh();
      // R66 round 27: when uploadJobPhoto returns a synthetic queued
      // record (pp-* id prefix), the photo is held offline. Tell the
      // contractor it'll sync rather than show success+silence; without
      // this they wouldn't know to expect a delayed cloud copy.
      if (upload.id.startsWith('pp-')) {
        Alert.alert(
          t('jobs.photos.queuedTitle', 'Photo saved offline'),
          t('jobs.photos.queuedDesc', 'It will upload to the cloud as soon as you reconnect or the parent job syncs.'),
        );
      }
    } else {
      // Note: with R27 the queue handles every legitimate failure path,
      // so this branch only fires for fundamental issues (no Supabase
      // configured, FileSystem write itself failed, etc).
      Alert.alert(
        t('jobs.photos.uploadFailedTitle', 'Upload failed'),
        t('jobs.photos.uploadFailedDesc', 'Photo could not be uploaded. Try again when online.'),
      );
    }
  };

  const handleDelete = (photo: JobPhotoRecord) => {
    Alert.alert(
      t('jobs.photos.deleteTitle', 'Delete photo?'),
      t('jobs.photos.deleteDesc', 'This cannot be undone.'),
      [
        { text: t('common.cancel', 'Cancel'), style: 'cancel' },
        {
          text: t('common.delete', 'Delete'),
          style: 'destructive',
          onPress: async () => {
            await deleteJobPhoto(photo.id, photo.storagePath);
            await refresh();
          },
        },
      ],
    );
  };

  return (
    <View style={s.container}>
      <View style={s.header}>
        <Pressable onPress={() => router.back()} style={s.backBtn} accessibilityRole="button" accessibilityLabel={t('common.back', 'Back')}>
          <Ionicons name="chevron-back" size={22} color={SemanticColors.textPrimary} />
        </Pressable>
        <Text style={s.title}>{t('jobs.photos.title', 'Photos')}</Text>
        <View style={{ width: 36 }} />
      </View>

      <View style={s.kindRow}>
        {KINDS.map((k) => (
          <Pressable
            key={k}
            onPress={() => handlePick(k)}
            style={s.kindBtn}
            disabled={uploading}
            accessibilityRole="button"
            accessibilityLabel={t('jobs.photos.addKind', { defaultValue: 'Add {{kind}} photo', kind: KIND_LABELS[k] })}
          >
            <Ionicons name="camera" size={16} color={Palette.hermesOrange} />
            <Text style={s.kindText}>{KIND_LABELS[k]}</Text>
          </Pressable>
        ))}
      </View>

      {loading ? (
        <ActivityIndicator style={{ marginTop: GRID.xl }} color={Palette.hermesOrange} />
      ) : photos.length === 0 ? (
        <View style={s.empty}>
          <Ionicons name="images-outline" size={48} color={SemanticColors.textTertiary} />
          <Text style={s.emptyText}>{t('jobs.photos.empty', 'No photos yet')}</Text>
          <Text style={s.emptyDesc}>{t('jobs.photos.emptyDesc', 'Tap a tag above to capture one.')}</Text>
        </View>
      ) : (
        <ScrollView style={s.scroll} contentContainerStyle={s.scrollContent}>
          {photos.map((p) => (
            <View key={p.id} style={s.card}>
              {p.publicUrl ? <Image source={{ uri: p.publicUrl }} style={s.image} resizeMode="cover" /> : <View style={s.imagePlaceholder} />}
              <View style={s.cardFooter}>
                <Text style={s.kindBadge}>{KIND_LABELS[p.kind] ?? p.kind}</Text>
                <Text style={s.takenAt}>{new Date(p.takenAt).toLocaleString()}</Text>
                <Pressable onPress={() => handleDelete(p)} hitSlop={8} accessibilityRole="button" accessibilityLabel={t('jobs.photos.deleteTitle', 'Delete photo?')}>
                  <Ionicons name="trash-outline" size={18} color={SemanticColors.feedbackError} />
                </Pressable>
              </View>
            </View>
          ))}
        </ScrollView>
      )}
    </View>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: PAGE_BG, paddingTop: SafeArea.top },
  // R12.1: was `backgroundColor: Palette.white` (literal #FFFFFF) on a DK-dark
  // page — rendered as a glaring white header bar above a dark scroll. Same
  // for the photo cards below. Switched to surfacePrimary (DK panel color).
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: GRID.md, paddingVertical: GRID.sm,
    backgroundColor: SemanticColors.surfacePrimary,
    borderBottomWidth: 1, borderBottomColor: SemanticColors.borderDefault,
  },
  backBtn: { width: 36, height: 36, alignItems: 'center', justifyContent: 'center', borderRadius: RADIUS.sm },
  title: { fontSize: TYPE.sectionSize, fontFamily: TYPE.sectionFamily, color: SemanticColors.textPrimary },
  kindRow: { flexDirection: 'row', flexWrap: 'wrap', gap: GRID.sm, padding: GRID.md },
  kindBtn: {
    flexDirection: 'row', alignItems: 'center', gap: GRID.xs,
    paddingHorizontal: GRID.sm + 2, paddingVertical: GRID.sm,
    backgroundColor: Palette.hermesOrange + '10', borderRadius: RADIUS.sm,
  },
  kindText: { fontSize: TYPE.captionSize, fontFamily: TYPE.titleFamily, color: Palette.hermesOrange, textTransform: 'capitalize' },
  scroll: { flex: 1 },
  scrollContent: { padding: GRID.md, gap: GRID.md },
  card: { backgroundColor: SemanticColors.surfacePrimary, borderRadius: RADIUS.lg, overflow: 'hidden' },
  image: { width: '100%', height: 220 },
  imagePlaceholder: { width: '100%', height: 220, backgroundColor: SemanticColors.surfaceSecondary },
  cardFooter: { flexDirection: 'row', alignItems: 'center', gap: GRID.sm, padding: GRID.sm + 2 },
  kindBadge: {
    fontSize: TYPE.tinySize, fontFamily: TYPE.sectionFamily, color: Palette.hermesOrange,
    textTransform: 'uppercase', letterSpacing: 0.5,
  },
  takenAt: { flex: 1, fontSize: TYPE.captionSize, fontFamily: TYPE.captionFamily, color: SemanticColors.textTertiary },
  empty: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: GRID.sm, padding: GRID.xl },
  emptyText: { fontSize: TYPE.titleSize, fontFamily: TYPE.titleFamily, color: SemanticColors.textPrimary },
  emptyDesc: { fontSize: TYPE.captionSize, fontFamily: TYPE.captionFamily, color: SemanticColors.textSecondary, textAlign: 'center' },
});
