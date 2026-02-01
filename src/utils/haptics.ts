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
