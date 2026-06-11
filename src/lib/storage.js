import AsyncStorage from '@react-native-async-storage/async-storage';

export const KEYS = {
  PERFORMANCE: 'lernapp:performance',
  ACTIVE_MODULES: 'lernapp:active_modules',
  FLAGGED: 'lernapp:flagged',
  FONT_SIZE: 'lernapp:font_size',
  // v1.1
  SELECTION: 'lernapp:selection',       // { schriftlich: true, kommission: true }
  DAILY: 'lernapp:today',               // { date: 'YYYY-MM-DD', count: N }
  STREAK: 'lernapp:streak',             // { count: N, lastDate: 'YYYY-MM-DD' }
  DAILY_GOAL: 'lernapp:daily_goal',     // number (default 20)
  REPORTS: 'lernapp:reports',           // { [id]: { comment, reportedAt, sent } }
  NOTIF_PREFS: 'lernapp:notif_prefs',   // [{hour,minute,enabled},...]
  // v1.1.1
  THEME: 'lernapp:theme',               // 'dark' | 'light' | 'system'
  NUR_PRUEFUNG: 'lernapp:nur_pruefung', // boolean — Modul-Filter
};

export async function loadJSON(key, fallback) {
  try {
    const val = await AsyncStorage.getItem(key);
    return val !== null ? JSON.parse(val) : fallback;
  } catch {
    return fallback;
  }
}

export async function saveJSON(key, value) {
  try {
    await AsyncStorage.setItem(key, JSON.stringify(value));
  } catch {}
}

// Map old module IDs to new merged IDs
const MODULE_MIGRATIONS = [
  { old: ['lss_dmaic_1', 'lss_dmaic_2', 'lss_dmaic_3'], newId: 'lss_dmaic' },
  { old: ['qs_1_msa_pum', 'qs_2_spc'],                  newId: 'qs' },
  { old: ['pmi_1', 'pmi_2', 'pmi_3'],                   newId: 'pmi' },
  { old: ['scrum_psm_1', 'scrum_psm_2'],                 newId: 'scrum_psm' },
  // v1.1.3: module consolidations
  { old: ['design_thinking_1', 'design_thinking_2'],                   newId: 'design_thinking' },
  { old: ['digi_ki_2', 'digi_ki_3', 'digi_ki_4'],                      newId: 'digi_ki_vertiefung' },
];

export function migrateActiveModules(stored) {
  let result = { ...stored };
  let changed = false;
  for (const { old: oldIds, newId } of MODULE_MIGRATIONS) {
    const anyOld = oldIds.some((id) => id in result);
    if (!anyOld) continue;
    if (!(newId in result)) {
      result[newId] = oldIds.some((id) => result[id] !== false);
    }
    oldIds.forEach((id) => delete result[id]);
    changed = true;
  }
  return { result, changed };
}

// Tages-Datum als YYYY-MM-DD
export function todayKey() {
  const d = new Date();
  return d.getFullYear() + '-' +
    String(d.getMonth() + 1).padStart(2, '0') + '-' +
    String(d.getDate()).padStart(2, '0');
}

// Tages-Zähler inkrementieren, gibt neues daily-Objekt zurück
export async function incrementDaily() {
  const today = todayKey();
  const stored = await loadJSON(KEYS.DAILY, { date: '', count: 0 });
  const daily = stored.date === today
    ? { date: today, count: stored.count + 1 }
    : { date: today, count: 1 };
  await saveJSON(KEYS.DAILY, daily);
  return daily;
}

// Streak aktualisieren wenn Tagesziel erreicht; gibt neue Streak zurück
export async function updateStreak(dailyCount, goal) {
  const today = todayKey();
  const yesterday = (() => {
    const d = new Date();
    d.setDate(d.getDate() - 1);
    return d.getFullYear() + '-' +
      String(d.getMonth() + 1).padStart(2, '0') + '-' +
      String(d.getDate()).padStart(2, '0');
  })();

  if (dailyCount < goal) return await loadJSON(KEYS.STREAK, { count: 0, lastDate: '' });

  const streak = await loadJSON(KEYS.STREAK, { count: 0, lastDate: '' });
  if (streak.lastDate === today) return streak; // already counted today
  const newCount = streak.lastDate === yesterday ? streak.count + 1 : 1;
  const updated = { count: newCount, lastDate: today };
  await saveJSON(KEYS.STREAK, updated);
  return updated;
}
