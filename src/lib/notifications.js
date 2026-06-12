import * as Notifications from 'expo-notifications';
import { loadJSON, KEYS, todayKey } from './storage';

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

function buildBody(remaining, goal) {
  if (remaining > 0) {
    const fragen = remaining === 1 ? 'Frage' : 'Fragen';
    const fehlt  = remaining === 1 ? 'Frage fehlt' : 'Fragen fehlen';
    const pool = [
      `📚 Noch ${remaining} ${fragen} bis zu deinem Tagesziel (${goal}) – du schaffst das! 💪`,
      `⏳ Nur noch ${remaining} ${fragen} bis zum Tagesziel (${goal}). Dranbleiben! 🔥`,
      `🎯 ${remaining} ${fehlt} dir zum Tagesziel (${goal}). Los geht's! ✏️`,
    ];
    return pool[Math.floor(Math.random() * pool.length)];
  }
  const pool = [
    '🎉 Tagesziel geschafft! Schön, wenn du trotzdem dranbleibst – regelmäßiges Üben festigt dein Wissen. 🧠',
    '✅ Ziel für heute erreicht! Jede weitere Frage festigt dein Wissen – bleib dran! 🔥',
    '🌟 Tagesziel erreicht! Wer dranbleibt, festigt sein Wissen nachhaltig. 💪',
  ];
  return pool[Math.floor(Math.random() * pool.length)];
}

export async function scheduleReminders(times, remaining = null, goal = null) {
  await Notifications.cancelAllScheduledNotificationsAsync();
  const granted = await requestPermission();
  if (!granted) return false;

  if (remaining === null || goal === null) {
    const [daily, g] = await Promise.all([
      loadJSON(KEYS.DAILY, { date: '', count: 0 }),
      loadJSON(KEYS.DAILY_GOAL, 25),
    ]);
    const todayCount = daily.date === todayKey() ? daily.count : 0;
    goal      = goal      ?? g;
    remaining = remaining ?? Math.max(0, goal - todayCount);
  }

  const body = buildBody(remaining, goal);

  for (const t of times) {
    if (!t.enabled) continue;
    await Notifications.scheduleNotificationAsync({
      content: {
        title: '📖 LSS Lern-App',
        body,
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
