// =============================================================================
// JOB PHOTO GALLERY
// =============================================================================
// Lists every photo uploaded for a job, lets the contractor tag a kind
// (before/during/after/defect/handover) and delete stale ones.
// =============================================================================

import { useEffect, useState, useCallback } from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable, Image, ActivityIndicator, Alert } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { SafeArea } from '../../../../src/theme/spacing';
import { SemanticColors, Palette } from '../../../../src/theme/colors';
import { PAGE_BG, TYPE, RADIUS, GRID } from '../../../../src/theme/tabStyles';
import { listJobPhotos, uploadJobPhoto, deleteJobPhoto, type JobPhotoRecord, type PhotoKind } from '../../../../src/services/jobPhotoService';
import { hapticSuccess } from '../../../../src/utils/haptics';

const KINDS: PhotoKind[] = ['before', 'during', 'after', 'defect', 'handover'];

export default function JobPhotosScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const [photos, setPhotos] = useState<JobPhotoRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);

  const refresh = useCallback(async () => {
    if (!id) return;
    setLoading(true);
    const list = await listJobPhotos(String(id));
    setPhotos(list);
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
    } else {
      Alert.alert('Upload failed', 'Photo could not be uploaded. Try again when online.');
    }
  };

  const handleDelete = (photo: JobPhotoRecord) => {
    Alert.alert('Delete photo?', 'This cannot be undone.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          await deleteJobPhoto(photo.id, photo.storagePath);
          await refresh();
        },
      },
    ]);
  };

  return (
    <View style={s.container}>
      <View style={s.header}>
        <Pressable onPress={() => router.back()} style={s.backBtn} accessibilityRole="button" accessibilityLabel="Back">
          <Ionicons name="arrow-back" size={22} color={SemanticColors.textPrimary} />
        </Pressable>
        <Text style={s.title}>Photos</Text>
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
            accessibilityLabel={`Add ${k} photo`}
          >
            <Ionicons name="camera" size={16} color={Palette.hermesOrange} />
            <Text style={s.kindText}>{k}</Text>
          </Pressable>
        ))}
      </View>

      {loading ? (
        <ActivityIndicator style={{ marginTop: GRID.xl }} color={Palette.hermesOrange} />
      ) : photos.length === 0 ? (
        <View style={s.empty}>
          <Ionicons name="images-outline" size={48} color={SemanticColors.textTertiary} />
          <Text style={s.emptyText}>No photos yet</Text>
          <Text style={s.emptyDesc}>Tap a tag above to capture one.</Text>
        </View>
      ) : (
        <ScrollView style={s.scroll} contentContainerStyle={s.scrollContent}>
          {photos.map((p) => (
            <View key={p.id} style={s.card}>
              {p.publicUrl ? <Image source={{ uri: p.publicUrl }} style={s.image} resizeMode="cover" /> : <View style={s.imagePlaceholder} />}
              <View style={s.cardFooter}>
                <Text style={s.kindBadge}>{p.kind}</Text>
                <Text style={s.takenAt}>{new Date(p.takenAt).toLocaleString()}</Text>
                <Pressable onPress={() => handleDelete(p)} hitSlop={8} accessibilityRole="button" accessibilityLabel="Delete photo">
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
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: GRID.md, paddingVertical: GRID.sm,
    backgroundColor: Palette.white,
    borderBottomWidth: 1, borderBottomColor: SemanticColors.borderMuted,
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
  card: { backgroundColor: Palette.white, borderRadius: RADIUS.lg, overflow: 'hidden' },
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
