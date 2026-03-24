// =============================================================================
// PUSH NOTIFICATION SERVICE
// =============================================================================
// Expo push notifications for payment reminders, follow-ups, and AI alerts
// Integrates with accounting loop for automated reminders
// =============================================================================

import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { MS_PER_HOUR } from '../utils/timeConstants';

const TOKEN_KEY = '@vasco_push_token';

// ---------------------------------------------------------------------------
// Configuration
// ---------------------------------------------------------------------------

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
  }),
});

// ---------------------------------------------------------------------------
// Registration
// ---------------------------------------------------------------------------

export async function registerForPushNotifications(): Promise<string | null> {
  try {
    const { status: existingStatus } = await Notifications.getPermissionsAsync();
    let finalStatus = existingStatus;

    if (existingStatus !== 'granted') {
      const { status } = await Notifications.requestPermissionsAsync();
      finalStatus = status;
    }

    if (finalStatus !== 'granted') return null;

    // Android channel
    if (Platform.OS === 'android') {
      await Notifications.setNotificationChannelAsync('default', {
        name: 'Vasco',
        importance: Notifications.AndroidImportance.HIGH,
        vibrationPattern: [0, 250, 250, 250],
      });
    }

    const tokenData = await Notifications.getExpoPushTokenAsync();
    const token = tokenData.data;
    await AsyncStorage.setItem(TOKEN_KEY, token);
    return token;
  } catch {
    return null;
  }
}

export async function getPushToken(): Promise<string | null> {
  try {
    return await AsyncStorage.getItem(TOKEN_KEY);
  } catch {
    return null;
  }
}

// ---------------------------------------------------------------------------
// Local notifications (no server needed)
// ---------------------------------------------------------------------------

export async function schedulePaymentReminder(data: {
  invoiceId: string;
  customerName: string;
  amount: number;
  daysUntilDue: number;
}): Promise<string | null> {
  try {
    const id = await Notifications.scheduleNotificationAsync({
      content: {
        title: 'Betaalherinnering',
        body: `Factuur voor ${data.customerName} (€${data.amount.toLocaleString(undefined)}) is over ${data.daysUntilDue} dagen verlopen`,
        data: { type: 'payment_reminder', invoiceId: data.invoiceId },
      },
      trigger: {
        type: Notifications.SchedulableTriggerInputTypes.TIME_INTERVAL,
        seconds: data.daysUntilDue * 86400,
      },
    });
    return id;
  } catch {
    return null;
  }
}

export async function scheduleQuoteFollowUp(data: {
  quoteId: string;
  customerName: string;
  daysAfterSent?: number;
}): Promise<string | null> {
  try {
    const days = data.daysAfterSent ?? 3;
    const id = await Notifications.scheduleNotificationAsync({
      content: {
        title: 'Offerte opvolgen',
        body: `Offerte voor ${data.customerName} is ${days} dagen geleden verstuurd — tijd om op te volgen`,
        data: { type: 'quote_followup', quoteId: data.quoteId },
      },
      trigger: {
        type: Notifications.SchedulableTriggerInputTypes.TIME_INTERVAL,
        seconds: days * 86400,
      },
    });
    return id;
  } catch {
    return null;
  }
}

export async function scheduleJobReminder(data: {
  jobId: string;
  jobTitle: string;
  scheduledTime: Date;
}): Promise<string | null> {
  try {
    // Remind 1 hour before
    const reminderTime = new Date(data.scheduledTime.getTime() - MS_PER_HOUR);
    if (reminderTime.getTime() <= Date.now()) return null;

    const id = await Notifications.scheduleNotificationAsync({
      content: {
        title: 'Klus herinnering',
        body: `${data.jobTitle} begint over 1 uur`,
        data: { type: 'job_reminder', jobId: data.jobId },
      },
      trigger: {
        type: Notifications.SchedulableTriggerInputTypes.DATE,
        date: reminderTime,
      },
    });
    return id;
  } catch {
    return null;
  }
}

export async function sendInstantNotification(title: string, body: string, data?: Record<string, string>): Promise<void> {
  try {
    await Notifications.scheduleNotificationAsync({
      content: { title, body, data },
      trigger: null, // immediate
    });
  } catch {
    // Silent fail
  }
}

// ---------------------------------------------------------------------------
// Notification management
// ---------------------------------------------------------------------------

export async function cancelAllNotifications(): Promise<void> {
  await Notifications.cancelAllScheduledNotificationsAsync();
}

export async function getScheduledNotifications(): Promise<Notifications.NotificationRequest[]> {
  return Notifications.getAllScheduledNotificationsAsync();
}

export async function getBadgeCount(): Promise<number> {
  return Notifications.getBadgeCountAsync();
}

export async function setBadgeCount(count: number): Promise<void> {
  await Notifications.setBadgeCountAsync(count);
}
