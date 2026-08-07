import * as Haptics from 'expo-haptics';

const safeHaptic = async (fn: () => Promise<void>) => {
  try {
    await fn();
  } catch {
    // Haptics might be unavailable on some devices or simulators.
  }
};

export const hapticSuccess = () =>
  safeHaptic(() => Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success));

export const hapticWarning = () =>
  safeHaptic(() => Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning));

export const hapticError = () =>
  safeHaptic(() => Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error));

// Picking a row from a list is not an outcome, so it must not use a
// notification buzz — that reads as "something happened" for what is really
// just a cursor moving. selectionAsync is the light tick iOS uses for pickers.
export const hapticSelection = () => safeHaptic(() => Haptics.selectionAsync());
