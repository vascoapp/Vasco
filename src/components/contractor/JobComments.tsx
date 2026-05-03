// =============================================================================
// JOB COMMENTS & ACTIVITY FEED COMPONENT
// =============================================================================
// Inline comment thread + auto-logged activity entries for job detail screen.
// =============================================================================

import { useState, useRef, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  Pressable,
  FlatList,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { Palette, SemanticColors } from '../../theme/colors';
import { PAGE_BG, TYPE, GRID, RADIUS } from '../../theme/tabStyles';
import {
  useJobComments,
  getActivityIcon,
  type FeedItem,
  type ActivityType,
} from '../../services/jobCommentsService';

type IconName = keyof typeof Ionicons.glyphMap;

// =============================================================================
// PROPS
// =============================================================================

interface JobCommentsProps {
  jobId: string;
}

// =============================================================================
// TIME FORMATTING
// =============================================================================

function formatTimeAgo(isoDate: string): string {
  const now = Date.now();
  const then = new Date(isoDate).getTime();
  const diffMin = Math.floor((now - then) / 60000);
  if (diffMin < 1) return 'Just now';
  if (diffMin < 60) return `${diffMin}m ago`;
  const diffHrs = Math.floor(diffMin / 60);
  if (diffHrs < 24) return `${diffHrs}h ago`;
  const diffDays = Math.floor(diffHrs / 24);
  if (diffDays < 7) return `${diffDays}d ago`;
  return new Date(isoDate).toLocaleDateString(undefined, { day: 'numeric', month: 'short' });
}

// =============================================================================
// COMPONENT
// =============================================================================

export default function JobComments({ jobId }: JobCommentsProps) {
  const { t } = useTranslation();
  const { feed, loading, postComment } = useJobComments(jobId);
  const [inputText, setInputText] = useState('');
  const flatListRef = useRef<FlatList>(null);

  // Auto-scroll to bottom when feed updates
  useEffect(() => {
    if (feed.length > 0) {
      setTimeout(() => {
        flatListRef.current?.scrollToEnd({ animated: true });
      }, 100);
    }
  }, [feed.length]);

  const handleSend = async () => {
    if (!inputText.trim()) return;
    const text = inputText;
    setInputText('');
    await postComment(text);
  };

  const renderItem = ({ item }: { item: FeedItem }) => {
    if (item.kind === 'comment') {
      const comment = item.data;
      // R17.1: localized "You" fallback. Service no longer stores the
      // hardcoded English fallback — display layer resolves via t().
      const displayName = comment.userName?.trim() || t('jobs.youLabel', 'You');
      const initials = displayName.charAt(0).toUpperCase();
      return (
        <View style={s.commentRow}>
          <View style={s.commentAvatar}>
            <Text style={s.commentAvatarText}>{initials}</Text>
          </View>
          <View style={s.commentBubble}>
            <View style={s.commentHeader}>
              <Text style={s.commentAuthor}>{displayName}</Text>
              <Text style={s.commentTime}>{formatTimeAgo(comment.createdAt)}</Text>
            </View>
            <Text style={s.commentText}>{comment.text}</Text>
          </View>
        </View>
      );
    }

    // Activity entry
    const activity = item.data;
    const icon = getActivityIcon(activity.type);
    return (
      <View style={s.activityRow}>
        <View style={[s.activityDot, { backgroundColor: icon.color + '18' }]}>
          <Ionicons name={icon.name as IconName} size={14} color={icon.color} />
        </View>
        <Text style={s.activityText}>{activity.description}</Text>
        <Text style={s.activityTime}>{formatTimeAgo(activity.createdAt)}</Text>
      </View>
    );
  };

  if (loading) {
    return (
      <View style={s.container}>
        <View style={s.loadingRow}>
          <Ionicons name="chatbubbles-outline" size={20} color={SemanticColors.textDisabled} />
          <Text style={s.loadingText}>{t('jobs.loadingActivity', 'Loading activity...')}</Text>
        </View>
      </View>
    );
  }

  return (
    <View style={s.container}>
      {/* Feed */}
      {feed.length === 0 ? (
        <View style={s.emptyState}>
          <Ionicons name="chatbubbles-outline" size={28} color={SemanticColors.textDisabled} />
          <Text style={s.emptyText}>{t('jobs.noActivity', 'No activity yet')}</Text>
          <Text style={s.emptySubtext}>{t('jobs.noActivityDesc', 'Comments and activity will appear here')}</Text>
        </View>
      ) : (
        <View style={[s.feedContent, s.feedList]}>
          {feed.map((item, index) => (
            <View key={item.data.id + index}>{renderItem({ item, index } as any)}</View>
          ))}
        </View>
      )}

      {/* Comment input */}
      <View style={s.inputContainer}>
        <TextInput
          style={s.textInput}
          value={inputText}
          onChangeText={setInputText}
          placeholder={t('jobs.addComment', 'Add a comment...')}
          placeholderTextColor={SemanticColors.textDisabled}
          multiline
          maxLength={500}
          returnKeyType="send"
          blurOnSubmit
          onSubmitEditing={handleSend}
        />
        <Pressable
          style={[s.sendButton, !inputText.trim() && s.sendButtonDisabled]}
          onPress={handleSend}
          disabled={!inputText.trim()}
          accessibilityRole="button"
          accessibilityLabel={t('jobs.sendComment', 'Send comment')}
        >
          <Ionicons
            name="send"
            size={18}
            color={inputText.trim() ? '#fff' : SemanticColors.textDisabled}
          />
        </Pressable>
      </View>
    </View>
  );
}

// =============================================================================
// STYLES
// =============================================================================

const s = StyleSheet.create({
  container: {
    gap: GRID.sm,
  },
  loadingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: GRID.sm,
    paddingVertical: GRID.lg,
  },
  loadingText: {
    fontSize: TYPE.captionSize,
    fontFamily: TYPE.captionFamily,
    color: SemanticColors.textDisabled,
  },

  // Feed
  feedList: {
    maxHeight: 300,
  },
  feedContent: {
    gap: GRID.sm,
    paddingVertical: GRID.xs,
  },

  // Comment
  commentRow: {
    flexDirection: 'row',
    gap: GRID.sm,
    alignItems: 'flex-start',
  },
  commentAvatar: {
    width: 32,
    height: 32,
    borderRadius: RADIUS.full,
    backgroundColor: Palette.hermesOrange,
    alignItems: 'center',
    justifyContent: 'center',
  },
  commentAvatarText: {
    fontSize: TYPE.labelSize,
    fontFamily: TYPE.sectionFamily,
    color: Palette.white,
  },
  commentBubble: {
    flex: 1,
    backgroundColor: SemanticColors.surfacePrimary,
    borderRadius: RADIUS.md,
    padding: GRID.md - 4,
    gap: GRID.xs,
  },
  commentHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  commentAuthor: {
    fontSize: TYPE.labelSize,
    fontFamily: TYPE.titleFamily,
    color: SemanticColors.textPrimary,
  },
  commentTime: {
    fontSize: TYPE.tinySize,
    fontFamily: TYPE.captionFamily,
    color: SemanticColors.textTertiary,
  },
  commentText: {
    fontSize: TYPE.bodySize,
    fontFamily: TYPE.bodyFamily,
    color: SemanticColors.textPrimary,
    lineHeight: 20,
  },

  // Activity
  activityRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: GRID.sm,
    paddingVertical: GRID.xs,
    paddingHorizontal: GRID.xs,
  },
  activityDot: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  activityText: {
    flex: 1,
    fontSize: TYPE.captionSize,
    fontFamily: TYPE.captionFamily,
    color: SemanticColors.textSecondary,
  },
  activityTime: {
    fontSize: TYPE.tinySize,
    fontFamily: TYPE.captionFamily,
    color: SemanticColors.textTertiary,
  },

  // Empty
  emptyState: {
    alignItems: 'center',
    paddingVertical: GRID.xl,
    gap: GRID.sm,
  },
  emptyText: {
    fontSize: TYPE.bodySize,
    fontFamily: TYPE.titleFamily,
    color: SemanticColors.textTertiary,
  },
  emptySubtext: {
    fontSize: TYPE.captionSize,
    fontFamily: TYPE.captionFamily,
    color: SemanticColors.textDisabled,
  },

  // Input
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: GRID.sm,
    backgroundColor: SemanticColors.surfacePrimary,
    borderRadius: RADIUS.md,
    padding: GRID.sm,
  },
  textInput: {
    flex: 1,
    fontSize: TYPE.bodySize,
    fontFamily: TYPE.bodyFamily,
    color: SemanticColors.textPrimary,
    maxHeight: 80,
    paddingVertical: GRID.sm,
    paddingHorizontal: GRID.sm,
  },
  sendButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: Palette.hermesOrange,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sendButtonDisabled: {
    backgroundColor: SemanticColors.borderDefault,
  },
});
