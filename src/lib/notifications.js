import * as Notifications from 'expo-notifications';

const DEFAULT_TIMES = [
  { hour: 8,  minute: 0,  enabled: true },
  { hour: 12, minute: 30, enabled: true },
  { hour: 19, minute: 0,  enabled: true },
];

export { DEFAULT_TIMES };

export async function requestPermission() {
  const { status } = await Notifications.requestPermissionsAsync();
  return status === 'granted';
}

export async function scheduleReminders(times) {
  await Notifications.cancelAllScheduledNotificationsAsync();
  const granted = await requestPermission();
  if (!granted) return false;

  for (const t of times) {
    if (!t.enabled) continue;
    await Notifications.scheduleNotificationAsync({
      content: {
        title: 'LSS Lern-App',
        body: 'Zeit zum Üben! Ein paar Fragen halten dein Wissen frisch.',
        sound: true,
      },
      trigger: {
        type: Notifications.SchedulableTriggerInputTypes.DAILY,
        hour: t.hour,
        minute: t.minute,
      },
    });
  }
  return true;
}

export async function cancelAllReminders() {
  await Notifications.cancelAllScheduledNotificationsAsync();
}

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
  }),
});
