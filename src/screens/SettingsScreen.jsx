import React, { useState, useCallback } from 'react';
import {
  View, Text, TouchableOpacity, ScrollView, StyleSheet,
  Alert, Switch, Linking
} from 'react-native';
import * as Sharing from 'expo-sharing';
import * as FileSystem from 'expo-file-system/legacy';
import * as DocumentPicker from 'expo-document-picker';
import Constants from 'expo-constants';
import * as Updates from 'expo-updates';
import { useFocusEffect } from '@react-navigation/native';

import { useTheme } from '../lib/ThemeContext';
import { loadJSON, saveJSON, KEYS } from '../lib/storage';
import { scheduleReminders, cancelAllReminders, DEFAULT_TIMES } from '../lib/notifications';

const GITHUB_REPO  = 'https://github.com/nlein/LSS-Lern-App';
const REPORT_EMAIL = 'nic.lein@posteo.de';

function loadAllQuestions() {
  return require('../data/questions').all ?? [];
}

const FONT_OPTIONS = [
  { id: 'small',  label: 'Klein'  },
  { id: 'medium', label: 'Mittel' },
  { id: 'large',  label: 'Groß'   },
];

const DAILY_GOAL_OPTIONS = [15, 25, 50, 75, 100];

const THEME_OPTIONS = [
  { id: 'system', label: 'System' },
  { id: 'dark',   label: 'Dunkel' },
  { id: 'light',  label: 'Hell'   },
];

const PRESET_HOURS = [6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22];
const PRESET_MINS  = [0, 15, 30, 45];

function pad2(n) { return String(n).padStart(2, '0'); }

export default function SettingsScreen() {
  const { colors, mode: themeMode, setMode: setThemeMode } = useTheme();

  const [fontSize,   setFontSize]   = useState('medium');
  const [dailyGoal,  setDailyGoal]  = useState(25);
  const [notifPrefs, setNotifPrefs] = useState(DEFAULT_TIMES);
  const [flagged,    setFlagged]    = useState({});
  const [reports,    setReports]    = useState({});
  const [editingIdx, setEditingIdx] = useState(null);

  useFocusEffect(
    useCallback(() => {
      async function load() {
        const [fl, fs, rep, goal, prefs] = await Promise.all([
          loadJSON(KEYS.FLAGGED, {}),
          loadJSON(KEYS.FONT_SIZE, 'medium'),
          loadJSON(KEYS.REPORTS, {}),
          loadJSON(KEYS.DAILY_GOAL, 25),
          loadJSON(KEYS.NOTIF_PREFS, DEFAULT_TIMES),
        ]);
        setFlagged(fl);
        setFontSize(fs);
        setReports(rep);
        // Migration: old value not in new options list → reset to 25
        const migratedGoal = DAILY_GOAL_OPTIONS.includes(goal) ? goal : 25;
        if (migratedGoal !== goal) await saveJSON(KEYS.DAILY_GOAL, migratedGoal);
        setDailyGoal(migratedGoal);
        setNotifPrefs(Array.isArray(prefs) ? prefs : DEFAULT_TIMES);
      }
      load();
    }, [])
  );

  // ── Font size ──────────────────────────────────────────────────────────────
  async function handleFontSize(id) {
    setFontSize(id);
    await saveJSON(KEYS.FONT_SIZE, id);
  }

  // ── Daily goal ─────────────────────────────────────────────────────────────
  async function handleDailyGoal(val) {
    setDailyGoal(val);
    await saveJSON(KEYS.DAILY_GOAL, val);
  }

  // ── Notifications ──────────────────────────────────────────────────────────
  async function saveNotifs(updated) {
    setNotifPrefs(updated);
    await saveJSON(KEYS.NOTIF_PREFS, updated);
    await scheduleReminders(updated);
  }

  async function toggleNotif(idx) {
    await saveNotifs(notifPrefs.map((t, i) => i === idx ? { ...t, enabled: !t.enabled } : t));
  }

  async function removeNotif(idx) {
    if (notifPrefs.length <= 1) {
      await saveNotifs([{ ...notifPrefs[0], enabled: false }]);
      return;
    }
    await saveNotifs(notifPrefs.filter((_, i) => i !== idx));
    if (editingIdx === idx) setEditingIdx(null);
  }

  async function addNotif() {
    const newSlot = { hour: 12, minute: 0, enabled: true };
    await saveNotifs([...notifPrefs, newSlot]);
    setEditingIdx(notifPrefs.length);
  }

  function adjustTime(idx, field, delta) {
    const t = notifPrefs[idx];
    let h = t.hour, m = t.minute;
    if (field === 'hour') {
      h = (h + delta + 24) % 24;
    } else {
      m = (m + delta + 60) % 60;
    }
    const updated = notifPrefs.map((x, i) => i === idx ? { ...x, hour: h, minute: m } : x);
    saveNotifs(updated);
  }

  async function handleEnableAll() {
    const updated = notifPrefs.map((t) => ({ ...t, enabled: true }));
    const ok = await scheduleReminders(updated);
    if (!ok) {
      Alert.alert('Berechtigung fehlt', 'Bitte Benachrichtigungen in den Systemeinstellungen erlauben.');
    } else {
      setNotifPrefs(updated);
      await saveJSON(KEYS.NOTIF_PREFS, updated);
      Alert.alert('Aktiv', 'Tägliche Erinnerungen wurden aktiviert.');
    }
  }

  // ── Flagged export ─────────────────────────────────────────────────────────
  async function handleExportFlagged() {
    const flaggedIds = Object.keys(flagged);
    if (!flaggedIds.length) {
      Alert.alert('Keine markierten Fragen', 'Markiere Fragen beim Lernen mit dem ⚐-Symbol.');
      return;
    }
    const questions = loadAllQuestions();
    const flaggedList = flaggedIds.map((id) => {
      const q = questions.find((x) => x.id === id);
      return { ...q, _note: flagged[id]?.note ?? '', _flaggedAt: flagged[id]?.flaggedAt ?? null };
    });
    const json = JSON.stringify(flaggedList, null, 2);
    const path = FileSystem.cacheDirectory + 'markierte_fragen.json';
    await FileSystem.writeAsStringAsync(path, json, { encoding: FileSystem.EncodingType.UTF8 });
    const canShare = await Sharing.isAvailableAsync();
    if (canShare) {
      await Sharing.shareAsync(path, { mimeType: 'application/json', dialogTitle: 'Markierte Fragen' });
    } else {
      Alert.alert('Sharing nicht verfügbar', 'Datei: ' + path);
    }
  }

  async function handleClearFlagged() {
    Alert.alert('Markierungen löschen', 'Alle markierten Fragen zurücksetzen?', [
      { text: 'Abbrechen', style: 'cancel' },
      {
        text: 'Löschen', style: 'destructive',
        onPress: async () => {
          await saveJSON(KEYS.FLAGGED, {});
          setFlagged({});
        },
      },
    ]);
  }

  // ── Report sending (D: fix) ────────────────────────────────────────────────
  async function handleSendReports() {
    const ids = Object.keys(reports).filter((id) => !reports[id].sent);
    if (!ids.length) {
      Alert.alert('Keine neuen Meldungen', 'Noch keine fehlerhaften Fragen gemeldet.');
      return;
    }
    const body = 'Gemeldete fehlerhafte Fragen:\n\n' +
      ids.map((id) => `- ${id}${reports[id].comment ? ': ' + reports[id].comment : ''}`).join('\n');
    const encodedTitle = encodeURIComponent('Fehlerhafte Fragen – LSS Lern-App');
    const encodedBody  = encodeURIComponent(body);
    const githubUrl = `${GITHUB_REPO}/issues/new?title=${encodedTitle}&body=${encodedBody}`;
    const mailUrl   = `mailto:${REPORT_EMAIL}?subject=${encodedTitle}&body=${encodedBody}`;

    Alert.alert(
      `${ids.length} Meldung${ids.length !== 1 ? 'en' : ''} senden`,
      'Wie möchtest du sie melden?',
      [
        { text: 'GitHub Issue', onPress: () => Linking.openURL(githubUrl) },
        { text: 'E-Mail', onPress: () => Linking.openURL(mailUrl) },
        { text: 'Abbrechen', style: 'cancel' },
      ]
    );

    const updated = { ...reports };
    ids.forEach((id) => { updated[id] = { ...updated[id], sent: true }; });
    setReports(updated);
    await saveJSON(KEYS.REPORTS, updated);
  }

  // ── Backup Export (I) ─────────────────────────────────────────────────────
  async function handleExportProgress() {
    try {
      const snapshot = {};
      for (const [keyName, storeKey] of Object.entries(KEYS)) {
        snapshot[keyName] = await loadJSON(storeKey, null);
      }
      const payload = JSON.stringify({
        version: '1.1',
        exportedAt: Date.now(),
        data: snapshot,
      }, null, 2);
      const filePath = FileSystem.cacheDirectory + 'lss_backup_' + Date.now() + '.json';
      await FileSystem.writeAsStringAsync(filePath, payload, { encoding: FileSystem.EncodingType.UTF8 });
      const canShare = await Sharing.isAvailableAsync();
      if (canShare) {
        await Sharing.shareAsync(filePath, {
          mimeType: 'application/json',
          dialogTitle: 'Lernfortschritt exportieren',
          UTI: 'public.json',
        });
      } else {
        Alert.alert('Exportiert', 'Datei gespeichert:\n' + filePath);
      }
    } catch (e) {
      Alert.alert('Fehler', String(e?.message ?? e));
    }
  }

  // ── Backup Import (I) ─────────────────────────────────────────────────────
  async function handleImportProgress() {
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: 'application/json',
        copyToCacheDirectory: true,
      });
      if (result.canceled) return;

      const uri = result.assets?.[0]?.uri;
      if (!uri) { Alert.alert('Fehler', 'Keine Datei ausgewählt.'); return; }

      const content = await FileSystem.readAsStringAsync(uri, { encoding: FileSystem.EncodingType.UTF8 });
      const backup = JSON.parse(content);

      if (!backup?.data || !backup?.version) {
        Alert.alert('Fehler', 'Ungültige Backup-Datei.');
        return;
      }

      const exportDate = backup.exportedAt
        ? new Date(backup.exportedAt).toLocaleDateString('de-DE', {
            day: '2-digit', month: '2-digit', year: 'numeric',
            hour: '2-digit', minute: '2-digit',
          })
        : 'Unbekannt';

      Alert.alert(
        'Lernfortschritt importieren',
        `Backup vom ${exportDate} einspielen?\n\nDer aktuelle Fortschritt wird überschrieben.`,
        [
          { text: 'Abbrechen', style: 'cancel' },
          {
            text: 'Importieren',
            onPress: async () => {
              for (const [keyName, value] of Object.entries(backup.data)) {
                if (KEYS[keyName] !== undefined && value !== null) {
                  await saveJSON(KEYS[keyName], value);
                }
              }
              Alert.alert('Fertig', 'Lernfortschritt importiert. Bitte App neu starten, damit alle Daten geladen werden.');
            },
          },
        ]
      );
    } catch (e) {
      Alert.alert('Fehler', String(e?.message ?? e));
    }
  }

  // ── Stats reset ────────────────────────────────────────────────────────────
  async function handleResetStats() {
    Alert.alert('Statistiken zurücksetzen', 'Alle Lernfortschritte werden gelöscht. Fortfahren?', [
      { text: 'Abbrechen', style: 'cancel' },
      {
        text: 'Zurücksetzen', style: 'destructive',
        onPress: async () => {
          await saveJSON(KEYS.PERFORMANCE, {});
          Alert.alert('Zurückgesetzt', 'Alle Statistiken wurden gelöscht.');
        },
      },
    ]);
  }

  const reportCount = Object.keys(reports).filter((id) => !reports[id].sent).length;
  const flaggedCount = Object.keys(flagged).length;
  const appVersion = Constants.expoConfig?.version ?? '1.1';
  const updateInfo = (() => {
    try {
      if (Updates.isEmbeddedLaunch || !Updates.updateId) return 'Stand: Eingebaut';
      const dateStr = Updates.createdAt
        ? new Date(Updates.createdAt).toLocaleDateString('de-DE', { day:'2-digit', month:'2-digit', year:'numeric' })
        : '–';
      return `Update: ${Updates.updateId.slice(0, 8)} · ${dateStr}`;
    } catch { return ''; }
  })();

  const styles = makeStyles(colors);

  return (
    <ScrollView style={styles.container} showsVerticalScrollIndicator={false}>

      {/* Erscheinungsbild (J) */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Erscheinungsbild</Text>
        <View style={styles.row}>
          {THEME_OPTIONS.map((opt) => (
            <TouchableOpacity
              key={opt.id}
              style={[styles.optBtn, themeMode === opt.id && styles.optBtnActive]}
              onPress={() => setThemeMode(opt.id)}
            >
              <Text style={[styles.optBtnText, themeMode === opt.id && styles.optBtnTextActive]}>
                {opt.label}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>

      {/* Schriftgröße */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Schriftgröße</Text>
        <View style={styles.row}>
          {FONT_OPTIONS.map((opt) => (
            <TouchableOpacity
              key={opt.id}
              style={[styles.optBtn, fontSize === opt.id && styles.optBtnActive]}
              onPress={() => handleFontSize(opt.id)}
            >
              <Text style={[styles.optBtnText, fontSize === opt.id && styles.optBtnTextActive]}>
                {opt.label}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>

      {/* Tagesziel */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Tagesziel (Fragen)</Text>
        <View style={styles.row}>
          {DAILY_GOAL_OPTIONS.map((val) => (
            <TouchableOpacity
              key={val}
              style={[styles.optBtn, dailyGoal === val && styles.optBtnActive]}
              onPress={() => handleDailyGoal(val)}
            >
              <Text style={[styles.optBtnText, dailyGoal === val && styles.optBtnTextActive]}>
                {val}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>

      {/* Erinnerungen (F: variable) */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Tägliche Erinnerungen</Text>
        {notifPrefs.map((t, idx) => (
          <View key={idx}>
            <View style={styles.notifRow}>
              <TouchableOpacity
                style={styles.notifTime}
                onPress={() => setEditingIdx(editingIdx === idx ? null : idx)}
              >
                <Text style={styles.notifTimeText}>{pad2(t.hour)}:{pad2(t.minute)} Uhr</Text>
              </TouchableOpacity>
              <Switch
                value={t.enabled}
                onValueChange={() => toggleNotif(idx)}
                trackColor={{ false: colors.border, true: colors.accent + '66' }}
                thumbColor={t.enabled ? colors.accent : colors.textMuted}
              />
              <TouchableOpacity
                onPress={() => removeNotif(idx)}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                style={styles.removeBtn}
              >
                <Text style={styles.removeBtnText}>×</Text>
              </TouchableOpacity>
            </View>
            {editingIdx === idx && (
              <View style={styles.timePicker}>
                <View style={styles.timeField}>
                  <TouchableOpacity style={styles.timeStep} onPress={() => adjustTime(idx, 'hour', 1)}>
                    <Text style={styles.timeStepText}>+1h</Text>
                  </TouchableOpacity>
                  <Text style={styles.timeValue}>{pad2(t.hour)}</Text>
                  <TouchableOpacity style={styles.timeStep} onPress={() => adjustTime(idx, 'hour', -1)}>
                    <Text style={styles.timeStepText}>−1h</Text>
                  </TouchableOpacity>
                </View>
                <Text style={styles.timeSep}>:</Text>
                <View style={styles.timeField}>
                  <TouchableOpacity style={styles.timeStep} onPress={() => adjustTime(idx, 'minute', 15)}>
                    <Text style={styles.timeStepText}>+15m</Text>
                  </TouchableOpacity>
                  <Text style={styles.timeValue}>{pad2(t.minute)}</Text>
                  <TouchableOpacity style={styles.timeStep} onPress={() => adjustTime(idx, 'minute', -15)}>
                    <Text style={styles.timeStepText}>−15m</Text>
                  </TouchableOpacity>
                </View>
                <TouchableOpacity
                  style={styles.doneBtn}
                  onPress={() => setEditingIdx(null)}
                >
                  <Text style={styles.doneBtnText}>OK</Text>
                </TouchableOpacity>
              </View>
            )}
          </View>
        ))}
        <View style={styles.notifFooter}>
          <TouchableOpacity style={[styles.actionBtn, styles.halfBtn]} onPress={addNotif}>
            <Text style={styles.actionTitle}>+ Hinzufügen</Text>
          </TouchableOpacity>
          <TouchableOpacity style={[styles.actionBtn, styles.halfBtn]} onPress={handleEnableAll}>
            <Text style={styles.actionTitle}>Alle aktivieren</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Markierte Fragen */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Markierte Fragen</Text>
        <TouchableOpacity style={styles.actionBtn} onPress={handleExportFlagged}>
          <View style={styles.actionContent}>
            <Text style={styles.actionTitle}>Exportieren</Text>
            <Text style={styles.actionSub}>
              {flaggedCount > 0 ? `${flaggedCount} Frage${flaggedCount !== 1 ? 'n' : ''} markiert` : 'Keine markierten Fragen'}
            </Text>
          </View>
          <Text style={styles.actionArrow}>→</Text>
        </TouchableOpacity>
        {flaggedCount > 0 && (
          <TouchableOpacity style={[styles.actionBtn, styles.dangerBtn]} onPress={handleClearFlagged}>
            <Text style={styles.dangerText}>Markierungen löschen</Text>
          </TouchableOpacity>
        )}
      </View>

      {/* Fehlerhafte Fragen (D: fix) */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Fehlerhafte Fragen melden</Text>
        <TouchableOpacity
          style={[styles.actionBtn, reportCount === 0 && styles.actionBtnDim]}
          onPress={handleSendReports}
        >
          <View style={styles.actionContent}>
            <Text style={styles.actionTitle}>
              {reportCount > 0 ? `${reportCount} Meldung${reportCount !== 1 ? 'en' : ''} senden` : 'Keine neuen Meldungen'}
            </Text>
            <Text style={styles.actionSub}>GitHub Issue oder E-Mail</Text>
          </View>
          <Text style={styles.actionArrow}>→</Text>
        </TouchableOpacity>
      </View>

      {/* Lernfortschritt sichern (I) */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Lernfortschritt sichern</Text>
        <TouchableOpacity style={styles.actionBtn} onPress={handleExportProgress}>
          <View style={styles.actionContent}>
            <Text style={styles.actionTitle}>Fortschritt exportieren</Text>
            <Text style={styles.actionSub}>Alle Daten als JSON-Datei teilen/speichern</Text>
          </View>
          <Text style={styles.actionArrow}>→</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.actionBtn} onPress={handleImportProgress}>
          <View style={styles.actionContent}>
            <Text style={styles.actionTitle}>Fortschritt importieren</Text>
            <Text style={styles.actionSub}>Backup-Datei einlesen (überschreibt aktuellen Stand)</Text>
          </View>
          <Text style={styles.actionArrow}>→</Text>
        </TouchableOpacity>
      </View>

      {/* Statistiken */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Statistiken</Text>
        <TouchableOpacity style={[styles.actionBtn, styles.dangerBtn]} onPress={handleResetStats}>
          <Text style={styles.dangerText}>Lernfortschritt zurücksetzen</Text>
        </TouchableOpacity>
      </View>

      {/* Lernalgorithmus */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Lernalgorithmus</Text>
        <View style={styles.infoBox}>
          <Text style={styles.infoBoxText}>
            Jede Frage bekommt ein Gewicht:{'\n'}
            <Text style={styles.infoCode}>Gewicht = max(1, 10 + falsch×3 − richtig×2)</Text>
            {'\n\n'}Falsch beantwortete Fragen erscheinen häufiger. Bei offenen Fragen zählt „Konnte ich" als richtig, „Teilweise" als halb, „Konnte ich nicht" als falsch.
          </Text>
        </View>
      </View>

      {/* App-Info */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>App-Info</Text>
        <View style={styles.infoBox}>
          <Text style={styles.infoBoxText}>
            LSS Lern-App · Version {appVersion}{'\n'}
            {updateInfo ? updateInfo + '\n' : ''}Fragen lokal gespeichert · Updates per OTA{'\n\n'}
            Lizenz: MIT
          </Text>
          <TouchableOpacity onPress={() => Linking.openURL(GITHUB_REPO)} style={styles.linkBtn}>
            <Text style={styles.linkText}>GitHub-Repo öffnen →</Text>
          </TouchableOpacity>
        </View>
      </View>

      <View style={{ height: 32 }} />
    </ScrollView>
  );
}

function makeStyles(colors) {
  return StyleSheet.create({
    container: {
      flex: 1, backgroundColor: colors.bg,
      paddingHorizontal: 16, paddingTop: 12,
    },
    section: { marginBottom: 24 },
    sectionTitle: {
      color: colors.textMuted, fontSize: 12, fontWeight: '700',
      textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: 10,
    },
    row: { flexDirection: 'row', gap: 8 },
    optBtn: {
      flex: 1, backgroundColor: colors.surface, borderRadius: 10,
      padding: 12, alignItems: 'center',
      borderWidth: 1, borderColor: colors.border,
    },
    optBtnActive: { backgroundColor: colors.accentDim, borderColor: colors.accent },
    optBtnText:       { color: colors.textMuted, fontWeight: '600', fontSize: 14 },
    optBtnTextActive: { color: colors.accent },
    notifRow: {
      flexDirection: 'row', alignItems: 'center',
      backgroundColor: colors.surface, borderRadius: 10,
      padding: 12, marginBottom: 6,
      borderWidth: 1, borderColor: colors.border,
    },
    notifTime: { flex: 1 },
    notifTimeText: { color: colors.text, fontWeight: '600', fontSize: 15 },
    removeBtn: { marginLeft: 8, padding: 4 },
    removeBtnText: { color: colors.wrong, fontSize: 20, fontWeight: '700', lineHeight: 22 },
    timePicker: {
      flexDirection: 'row', alignItems: 'center',
      backgroundColor: colors.surface, borderRadius: 10,
      padding: 12, marginBottom: 8, gap: 12,
      borderWidth: 1, borderColor: colors.accent,
    },
    timeField: { alignItems: 'center', gap: 4 },
    timeStep:  {
      backgroundColor: colors.accentDim, borderRadius: 6,
      paddingHorizontal: 10, paddingVertical: 4,
    },
    timeStepText: { color: colors.accent, fontWeight: '700', fontSize: 12 },
    timeValue:    { color: colors.text, fontSize: 20, fontWeight: '700', minWidth: 32, textAlign: 'center' },
    timeSep:      { color: colors.text, fontSize: 24, fontWeight: '700' },
    doneBtn: {
      marginLeft: 'auto', backgroundColor: colors.accent,
      borderRadius: 8, paddingHorizontal: 16, paddingVertical: 8,
    },
    doneBtnText:    { color: '#fff', fontWeight: '700', fontSize: 14 },
    notifFooter:    { flexDirection: 'row', gap: 8, marginTop: 4 },
    halfBtn:        { flex: 1 },
    actionBtn: {
      backgroundColor: colors.surface, borderRadius: 12,
      padding: 16, marginBottom: 8,
      flexDirection: 'row', alignItems: 'center',
      borderWidth: 1, borderColor: colors.border,
    },
    actionBtnDim:   { opacity: 0.5 },
    actionContent:  { flex: 1 },
    actionTitle:    { color: colors.text, fontWeight: '600', fontSize: 15 },
    actionSub:      { color: colors.textMuted, fontSize: 12, marginTop: 2 },
    actionArrow:    { color: colors.textMuted, fontSize: 18 },
    dangerBtn:      { borderColor: colors.wrongDim },
    dangerText:     { color: colors.wrong, fontWeight: '600', fontSize: 15 },
    infoBox: {
      backgroundColor: colors.surface, borderRadius: 12,
      padding: 16, borderWidth: 1, borderColor: colors.border,
    },
    infoBoxText: { color: colors.textSub, fontSize: 13, lineHeight: 20 },
    infoCode:    { color: colors.accent, fontFamily: 'monospace' },
    linkBtn:     { marginTop: 12 },
    linkText:    { color: colors.accent, fontWeight: '600', fontSize: 14 },
  });
}
