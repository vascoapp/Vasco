// =============================================================================
// LEGACY ROUTE — /contractor/drag-schedule → /contractor/schedule
// =============================================================================
// The screen was renamed on 2026-08-19: it had never contained a drag, and the
// name was the most-read documentation it had, repeated at fourteen call sites.
//
// This stub exists because a rename is not a rename when the old path has
// already left the building:
//
//   · `notificationService` writes `actionRoute: '/contractor/drag-schedule'`
//     into push payloads. Notifications already scheduled or already sitting in
//     a device's tray still carry the old path, and they outlive the OTA that
//     renames the file.
//   · `queueItemExecutor` pushes the route from a PERSISTED action-queue item,
//     so a queue entry written before the update names the old path too.
//   · Anything a contractor deep-linked or bookmarked.
//
// Deleting the file would turn every one of those into a blank screen — the
// failure would land on the contractor, weeks later, with no way to connect it
// to a rename. Keep until the notification TTL and the action queue have both
// turned over (queue prunes at 7 days), then delete.
//
// Params are forwarded verbatim: `?jobId=` is what makes the queue-suggested
// job highlight, and dropping it would leave the contractor on the right screen
// wondering which job they were sent to look at.
// =============================================================================

import { Redirect, useLocalSearchParams } from 'expo-router';

export default function DragScheduleRedirect() {
  const params = useLocalSearchParams();
  return <Redirect href={{ pathname: '/contractor/schedule', params } as never} />;
}
