import * as Notifications from 'expo-notifications';
import { loadJSON, KEYS } from './storage';

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

function buildBody(goal) {
  const pool = [
    `📚 Zeit zum Üben! Dein Tagesziel: ${goal} Fragen. Bleib dran! 💪`,
    `⏳ Kurze Lernrunde gefällig? Heute ${goal} Fragen fürs Tagesziel. 🔥`,
    `🎯 Dein Tagesziel wartet: ${goal} Fragen. Los geht's! ✏️`,
    `🌟 Jeden Tag ein bisschen – ${goal} Fragen halten dein Wissen frisch. 🧠`,
  ];
  return pool[Math.floor(Math.random() * pool.length)];
}

// In-flight lock: prevents concurrent cancel/schedule races from multiple callers
let _inFlight = null;

export async function scheduleReminders(times, goal = null) {
  if (_inFlight) await _inFlight.catch(() => {});

  let resolve;
  _inFlight = new Promise((r) => { resolve = r; });

  try {
    await Notifications.cancelAllScheduledNotificationsAsync();
    const granted = await requestPermission();
    if (!granted) return false;

    if (goal === null) {
      goal = await loadJSON(KEYS.DAILY_GOAL, 25);
    }

    const body = buildBody(goal);

    // Deduplicate by (hour, minute) before scheduling
    const seen = new Set();
    for (const t of times) {
      if (!t.enabled) continue;
      const key = `${t.hour}:${t.minute}`;
      if (seen.has(key)) continue;
      seen.add(key);
      await Notifications.scheduleNotificationAsync({
        content: { title: '📖 LSS Lern-App', body, sound: true },
        trigger: {
          type: Notifications.SchedulableTriggerInputTypes.DAILY,
          hour: t.hour,
          minute: t.minute,
        },
      });
    }
    return true;
  } finally {
    _inFlight = null;
    resolve?.();
  }
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
