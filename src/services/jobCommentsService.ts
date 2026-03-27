// =============================================================================
// JOB COMMENTS & ACTIVITY FEED SERVICE
// =============================================================================
// Comments and auto-logged activity entries for job collaboration.
// Persists per-job to AsyncStorage.
// =============================================================================

import AsyncStorage from '@react-native-async-storage/async-storage';
import { useState, useEffect, useCallback } from 'react';

// =============================================================================
// TYPES
// =============================================================================

export type ActivityType =
  | 'created'
  | 'status_changed'
  | 'comment'
  | 'photo_added'
  | 'material_added'
  | 'invoice_created'
  | 'timer_started'
  | 'timer_stopped';

export interface JobComment {
  id: string;
  jobId: string;
  userId: string;
  userName: string;
  text: string;
  createdAt: string;
}

export interface ActivityEntry {
  id: string;
  jobId: string;
  type: ActivityType;
  description: string;
  metadata?: Record<string, any>;
  userId?: string;
  userName?: string;
  createdAt: string;
}

export type FeedItem =
  | { kind: 'comment'; data: JobComment }
  | { kind: 'activity'; data: ActivityEntry };

// =============================================================================
// STORAGE
// =============================================================================

function commentsKey(jobId: string): string {
  return `@vasco_job_comments_${jobId}`;
}

function activityKey(jobId: string): string {
  return `@vasco_job_activity_${jobId}`;
}

async function loadComments(jobId: string): Promise<JobComment[]> {
  try {
    const raw = await AsyncStorage.getItem(commentsKey(jobId));
    if (raw) return JSON.parse(raw);
  } catch {}
  return [];
}

async function saveComments(jobId: string, comments: JobComment[]): Promise<void> {
  await AsyncStorage.setItem(commentsKey(jobId), JSON.stringify(comments)).catch(() => {});
}

async function loadActivity(jobId: string): Promise<ActivityEntry[]> {
  try {
    const raw = await AsyncStorage.getItem(activityKey(jobId));
    if (raw) return JSON.parse(raw);
  } catch {}
  return [];
}

async function saveActivity(jobId: string, entries: ActivityEntry[]): Promise<void> {
  await AsyncStorage.setItem(activityKey(jobId), JSON.stringify(entries)).catch(() => {});
}

// =============================================================================
// COMMENT OPERATIONS
// =============================================================================

export async function addComment(
  jobId: string,
  text: string,
  userId: string,
  userName?: string,
): Promise<JobComment> {
  const comments = await loadComments(jobId);
  const comment: JobComment = {
    id: `cmt-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    jobId,
    userId,
    userName: userName || 'You',
    text,
    createdAt: new Date().toISOString(),
  };
  comments.push(comment);
  await saveComments(jobId, comments);

  // Also add as activity entry
  await addActivityEntry(jobId, 'comment', text, { commentId: comment.id }, userId, userName);

  return comment;
}

export async function getComments(jobId: string): Promise<JobComment[]> {
  const comments = await loadComments(jobId);
  return comments.sort((a, b) => a.createdAt.localeCompare(b.createdAt));
}

// =============================================================================
// ACTIVITY OPERATIONS
// =============================================================================

export async function addActivityEntry(
  jobId: string,
  type: ActivityType,
  description: string,
  metadata?: Record<string, any>,
  userId?: string,
  userName?: string,
): Promise<ActivityEntry> {
  const entries = await loadActivity(jobId);
  const entry: ActivityEntry = {
    id: `act-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    jobId,
    type,
    description,
    metadata,
    userId,
    userName,
    createdAt: new Date().toISOString(),
  };
  entries.push(entry);
  await saveActivity(jobId, entries);
  return entry;
}

export async function getActivityFeed(jobId: string): Promise<ActivityEntry[]> {
  const entries = await loadActivity(jobId);
  return entries.sort((a, b) => a.createdAt.localeCompare(b.createdAt));
}

// =============================================================================
// COMBINED FEED
// =============================================================================

export async function getCombinedFeed(jobId: string): Promise<FeedItem[]> {
  const [comments, activities] = await Promise.all([
    loadComments(jobId),
    loadActivity(jobId),
  ]);

  // Filter out 'comment' type activities (already shown as comments)
  const nonCommentActivities = activities.filter(a => a.type !== 'comment');

  const feed: FeedItem[] = [
    ...comments.map(c => ({ kind: 'comment' as const, data: c })),
    ...nonCommentActivities.map(a => ({ kind: 'activity' as const, data: a })),
  ];

  return feed.sort((a, b) => {
    const aDate = a.kind === 'comment' ? a.data.createdAt : a.data.createdAt;
    const bDate = b.kind === 'comment' ? b.data.createdAt : b.data.createdAt;
    return aDate.localeCompare(bDate);
  });
}

// =============================================================================
// ACTIVITY ICON MAPPING
// =============================================================================

export function getActivityIcon(type: ActivityType): { name: string; color: string } {
  switch (type) {
    case 'created':
      return { name: 'add-circle-outline', color: '#94A3B8' };
    case 'status_changed':
      return { name: 'swap-horizontal', color: '#8B5CF6' };
    case 'comment':
      return { name: 'chatbubble-outline', color: '#3B82F6' };
    case 'photo_added':
      return { name: 'camera-outline', color: '#10B981' };
    case 'material_added':
      return { name: 'construct-outline', color: '#F59E0B' };
    case 'invoice_created':
      return { name: 'receipt-outline', color: '#0EA5E9' };
    case 'timer_started':
      return { name: 'play-circle-outline', color: '#E35205' };
    case 'timer_stopped':
      return { name: 'stop-circle-outline', color: '#EF4444' };
  }
}

// =============================================================================
// REACT HOOK
// =============================================================================

export function useJobComments(jobId: string) {
  const [feed, setFeed] = useState<FeedItem[]>([]);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    if (!jobId) return;
    const items = await getCombinedFeed(jobId);
    setFeed(items);
  }, [jobId]);

  useEffect(() => {
    if (!jobId) {
      setLoading(false);
      return;
    }
    getCombinedFeed(jobId).then(setFeed).finally(() => setLoading(false));
  }, [jobId]);

  const postComment = useCallback(async (text: string, userId?: string, userName?: string) => {
    if (!jobId || !text.trim()) return;
    await addComment(jobId, text.trim(), userId || 'current-user', userName);
    await refresh();
  }, [jobId, refresh]);

  const logActivity = useCallback(async (
    type: ActivityType,
    description: string,
    metadata?: Record<string, any>,
  ) => {
    if (!jobId) return;
    await addActivityEntry(jobId, type, description, metadata);
    await refresh();
  }, [jobId, refresh]);

  return { feed, loading, postComment, logActivity, refresh };
}
