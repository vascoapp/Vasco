// =============================================================================
// PHOTO GALLERY — Grid view of job photos with before/after toggle
// =============================================================================

import { useState, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  Image,
  Modal,
  ScrollView,
  Dimensions,
} from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useTranslation } from 'react-i18next';
import { SemanticColors, Palette } from '../../theme/colors';
import { PAGE_BG, TYPE, GRID, RADIUS } from '../../theme/tabStyles';
import { SafeArea } from '../../theme/spacing';
import { hapticSuccess } from '../../utils/haptics';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const THUMB_SIZE = (SCREEN_WIDTH - GRID.md * 2 - GRID.sm * 2) / 3;

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface PhotoItem {
  uri: string;
  date: string;
  label?: 'before' | 'after' | 'progress';
  notes?: string;
}

interface PhotoGalleryProps {
  photos: PhotoItem[];
  jobTitle: string;
  onAddPhoto?: () => void;
}

type FilterMode = 'all' | 'before' | 'after';

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function PhotoGallery({ photos, jobTitle, onAddPhoto }: PhotoGalleryProps) {
  const { t } = useTranslation();
  const [filter, setFilter] = useState<FilterMode>('all');
  const [selectedPhoto, setSelectedPhoto] = useState<PhotoItem | null>(null);

  const filteredPhotos = useMemo(() => {
    if (filter === 'all') return photos;
    return photos.filter(p => p.label === filter);
  }, [photos, filter]);

  const beforeCount = useMemo(() => photos.filter(p => p.label === 'before').length, [photos]);
  const afterCount = useMemo(() => photos.filter(p => p.label === 'after').length, [photos]);

  if (photos.length === 0 && !onAddPhoto) return null;

  return (
    <View style={styles.container}>
      {/* Section Header */}
      <View style={styles.sectionHeader}>
        <View style={styles.sectionTitleRow}>
          <Ionicons name="camera-outline" size={16} color={SemanticColors.textTertiary} />
          <Text style={styles.sectionLabel}>
            {t('jobs.photos', 'Photos')} ({photos.length})
          </Text>
        </View>
        {photos.length > 0 && (
          <View style={styles.countBadge}>
            <Text style={styles.countBadgeText}>{photos.length}</Text>
          </View>
        )}
      </View>

      {/* Before / After Toggle */}
      {(beforeCount > 0 || afterCount > 0) && (
        <View style={styles.filterRow}>
          {(['all', 'before', 'after'] as FilterMode[]).map((mode) => {
            const isActive = filter === mode;
            const label = mode === 'all'
              ? t('photos.all', 'All')
              : mode === 'before'
              ? t('photos.before', 'Before')
              : t('photos.after', 'After');
            const count = mode === 'all' ? photos.length : mode === 'before' ? beforeCount : afterCount;
            return (
              <Pressable
                key={mode}
                style={[styles.filterChip, isActive && styles.filterChipActive]}
                onPress={() => {
                  hapticSuccess();
                  setFilter(mode);
                }}
                accessibilityRole="button"
                accessibilityLabel={`${label} (${count})`}
                accessibilityState={{ selected: isActive }}
              >
                <Text style={[styles.filterChipText, isActive && styles.filterChipTextActive]}>
                  {label}
                </Text>
                {count > 0 && (
                  <Text style={[styles.filterChipCount, isActive && styles.filterChipCountActive]}>
                    {count}
                  </Text>
                )}
              </Pressable>
            );
          })}
        </View>
      )}

      {/* Photo Grid */}
      <View style={styles.grid}>
        {filteredPhotos.map((photo, idx) => (
          <Pressable
            key={`${photo.uri}-${idx}`}
            style={({ pressed }) => [styles.gridItem, pressed && { opacity: 0.85 }]}
            onPress={() => {
              hapticSuccess();
              setSelectedPhoto(photo);
            }}
            accessibilityRole="image"
            accessibilityLabel={`${photo.label || 'progress'} photo from ${photo.date}`}
          >
            <Image source={{ uri: photo.uri }} style={styles.thumb} resizeMode="cover" />
            {/* Date overlay */}
            <View style={styles.dateOverlay}>
              <Text style={styles.dateOverlayText}>
                {new Date(photo.date).toLocaleDateString(undefined, { day: 'numeric', month: 'short' })}
              </Text>
            </View>
            {/* Label badge */}
            {photo.label && (
              <View style={[
                styles.labelBadge,
                photo.label === 'before' && styles.labelBefore,
                photo.label === 'after' && styles.labelAfter,
                photo.label === 'progress' && styles.labelProgress,
              ]}>
                <Text style={[
                  styles.labelBadgeText,
                  photo.label === 'before' && styles.labelBeforeText,
                  photo.label === 'after' && styles.labelAfterText,
                  photo.label === 'progress' && styles.labelProgressText,
                ]}>
                  {photo.label === 'before'
                    ? t('photos.before', 'Before')
                    : photo.label === 'after'
                    ? t('photos.after', 'After')
                    : t('photos.progress', 'Progress')}
                </Text>
              </View>
            )}
          </Pressable>
        ))}

        {/* Add photo button */}
        {onAddPhoto && (
          <Pressable
            style={styles.addPhotoBtn}
            onPress={() => {
              hapticSuccess();
              onAddPhoto();
            }}
            accessibilityRole="button"
            accessibilityLabel={t('photos.addPhoto', 'Add photo')}
          >
            <Ionicons name="camera" size={24} color={Palette.hermesOrange} />
            <Text style={styles.addPhotoText}>{t('photos.add', 'Add')}</Text>
          </Pressable>
        )}
      </View>

      {/* Full-screen viewer modal */}
      <Modal
        visible={!!selectedPhoto}
        transparent
        animationType="fade"
        onRequestClose={() => setSelectedPhoto(null)}
      >
        <View style={styles.modalOverlay}>
          {/* Close button */}
          <Pressable
            style={styles.modalCloseBtn}
            onPress={() => setSelectedPhoto(null)}
            accessibilityRole="button"
            accessibilityLabel={t('common.close', 'Close')}
          >
            <Ionicons name="close" size={28} color="#fff" />
          </Pressable>

          {/* Photo title */}
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle} numberOfLines={1}>{jobTitle}</Text>
            {selectedPhoto?.label && (
              <View style={[
                styles.modalLabelBadge,
                selectedPhoto.label === 'before' && styles.labelBefore,
                selectedPhoto.label === 'after' && styles.labelAfter,
                selectedPhoto.label === 'progress' && styles.labelProgress,
              ]}>
                <Text style={[
                  styles.labelBadgeText,
                  selectedPhoto.label === 'before' && styles.labelBeforeText,
                  selectedPhoto.label === 'after' && styles.labelAfterText,
                  selectedPhoto.label === 'progress' && styles.labelProgressText,
                ]}>
                  {selectedPhoto.label === 'before'
                    ? t('photos.before', 'Before')
                    : selectedPhoto.label === 'after'
                    ? t('photos.after', 'After')
                    : t('photos.progress', 'Progress')}
                </Text>
              </View>
            )}
          </View>

          {/* Full image */}
          {selectedPhoto && (
            <ScrollView
              contentContainerStyle={styles.modalImageContainer}
              maximumZoomScale={4}
              minimumZoomScale={1}
              showsVerticalScrollIndicator={false}
              showsHorizontalScrollIndicator={false}
              bouncesZoom
            >
              <Image
                source={{ uri: selectedPhoto.uri }}
                style={styles.fullImage}
                resizeMode="contain"
              />
            </ScrollView>
          )}

          {/* Photo info footer */}
          {selectedPhoto && (
            <View style={styles.modalFooter}>
              <Text style={styles.modalDate}>
                {new Date(selectedPhoto.date).toLocaleDateString(undefined, {
                  weekday: 'long',
                  day: 'numeric',
                  month: 'long',
                  year: 'numeric',
                })}
              </Text>
              {selectedPhoto.notes && (
                <Text style={styles.modalNotes}>{selectedPhoto.notes}</Text>
              )}
            </View>
          )}
        </View>
      </Modal>
    </View>
  );
}

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------

const styles = StyleSheet.create({
  container: {
    gap: GRID.sm,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  sectionTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: GRID.sm,
  },
  sectionLabel: {
    fontSize: TYPE.captionSize,
    fontFamily: TYPE.sectionFamily,
    color: SemanticColors.textTertiary,
    letterSpacing: 0.8,
  },
  countBadge: {
    minWidth: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: Palette.hermesOrange,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 6,
  },
  countBadgeText: {
    fontSize: TYPE.labelSize,
    fontFamily: TYPE.sectionFamily,
    color: Palette.white,
  },

  // Filter row
  filterRow: {
    flexDirection: 'row',
    gap: GRID.sm,
  },
  filterChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: GRID.xs,
    paddingHorizontal: GRID.md - 4,
    paddingVertical: 6,
    borderRadius: RADIUS.sm,
    backgroundColor: SemanticColors.surfacePrimary,
  },
  filterChipActive: {
    backgroundColor: Palette.hermesOrange + '14',
  },
  filterChipText: {
    fontSize: TYPE.labelSize,
    fontFamily: TYPE.titleFamily,
    color: SemanticColors.textTertiary,
  },
  filterChipTextActive: {
    color: Palette.hermesOrange,
  },
  filterChipCount: {
    fontSize: TYPE.tinySize,
    fontFamily: TYPE.labelFamily,
    color: SemanticColors.textDisabled,
  },
  filterChipCountActive: {
    color: Palette.hermesOrange,
  },

  // Grid
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: GRID.sm,
  },
  gridItem: {
    width: THUMB_SIZE,
    height: THUMB_SIZE,
    borderRadius: RADIUS.md,
    overflow: 'hidden',
    position: 'relative',
  },
  thumb: {
    width: '100%',
    height: '100%',
  },
  dateOverlay: {
    position: 'absolute',
    top: GRID.xs,
    right: GRID.xs,
    backgroundColor: 'rgba(0,0,0,0.5)',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: GRID.xs,
  },
  dateOverlayText: {
    fontSize: TYPE.tinySize - 1,
    fontFamily: TYPE.labelFamily,
    color: Palette.white,
  },
  labelBadge: {
    position: 'absolute',
    bottom: GRID.xs,
    left: GRID.xs,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: GRID.xs,
  },
  labelBadgeText: {
    fontSize: TYPE.tinySize - 1,
    fontFamily: TYPE.sectionFamily,
    letterSpacing: 0.3,
  },
  labelBefore: {
    backgroundColor: SemanticColors.surfaceSecondary,
  },
  labelBeforeText: {
    color: SemanticColors.textTertiary,
  },
  labelAfter: {
    backgroundColor: SemanticColors.feedbackSuccess + '14',
  },
  labelAfterText: {
    color: SemanticColors.feedbackSuccess,
  },
  labelProgress: {
    backgroundColor: Palette.hermesOrange + '14',
  },
  labelProgressText: {
    color: Palette.hermesOrange,
  },

  // Add photo button
  addPhotoBtn: {
    width: THUMB_SIZE,
    height: THUMB_SIZE,
    borderRadius: RADIUS.md,
    borderWidth: 2,
    borderColor: Palette.hermesOrange + '30',
    borderStyle: 'dashed',
    alignItems: 'center',
    justifyContent: 'center',
    gap: GRID.xs,
  },
  addPhotoText: {
    fontSize: TYPE.tinySize - 1,
    fontFamily: TYPE.titleFamily,
    color: Palette.hermesOrange,
  },

  // Modal (full-screen viewer)
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.95)',
    justifyContent: 'center',
  },
  modalCloseBtn: {
    position: 'absolute',
    top: SafeArea.top + GRID.sm,
    right: GRID.md,
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(255,255,255,0.15)',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 10,
  },
  modalHeader: {
    position: 'absolute',
    top: SafeArea.top + GRID.sm,
    left: GRID.md,
    right: 60,
    flexDirection: 'row',
    alignItems: 'center',
    gap: GRID.sm,
    zIndex: 10,
  },
  modalTitle: {
    fontSize: TYPE.titleSize,
    fontFamily: TYPE.sectionFamily,
    color: Palette.white,
    flex: 1,
  },
  modalLabelBadge: {
    paddingHorizontal: GRID.sm,
    paddingVertical: 3,
    borderRadius: GRID.xs,
  },
  modalImageContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  fullImage: {
    width: SCREEN_WIDTH,
    height: SCREEN_WIDTH,
  },
  modalFooter: {
    position: 'absolute',
    bottom: SafeArea.top + GRID.lg,
    left: GRID.md,
    right: GRID.md,
    gap: GRID.xs,
  },
  modalDate: {
    fontSize: TYPE.captionSize,
    fontFamily: TYPE.captionFamily,
    color: 'rgba(255,255,255,0.7)',
  },
  modalNotes: {
    fontSize: TYPE.bodySize,
    fontFamily: TYPE.bodyFamily,
    color: 'rgba(255,255,255,0.9)',
  },
});
