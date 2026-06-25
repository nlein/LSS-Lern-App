import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import {
  View, Text, TouchableOpacity, ScrollView, StyleSheet, Alert, Switch
} from 'react-native';
import * as Haptics from 'expo-haptics';
import { useFocusEffect } from '@react-navigation/native';

import { useTheme } from '../lib/ThemeContext';
import { FONT_SIZES } from '../lib/theme';
import {
  loadJSON, saveJSON, KEYS, migrateActiveModules,
  incrementDaily, updateStreak, todayKey, checkStreakOnFocus,
} from '../lib/storage';
import { weightedRandom, filterQuestions } from '../lib/spacedRepetition';
import { scheduleReminders, DEFAULT_TIMES } from '../lib/notifications';
import QuestionCard from '../components/QuestionCard';
import OpenQuestionCard from '../components/OpenQuestionCard';
import MultiChoiceCard from '../components/MultiChoiceCard';
import modulesData from '../data/modules.json';

const DEFAULT_SELECTION  = { schriftlich: true, kommission: true };
const DEFAULT_DAILY_GOAL = 25;

function loadAllQuestions() {
  return require('../data/questions').all ?? [];
}

export default function LearnScreen() {
  const { colors } = useTheme();

  const [performance, setPerformance]   = useState({});
  const [activeModules, setActiveModules] = useState({});
  const [flagged, setFlagged]           = useState({});
  const [reports, setReports]           = useState({});
  const [selection, setSelection]       = useState(DEFAULT_SELECTION);
  const [fontSize, setFontSize]         = useState(FONT_SIZES.medium);
  const [questions, setQuestions]       = useState([]);
  const [dailyGoal, setDailyGoal]       = useState(DEFAULT_DAILY_GOAL);
  const [nurPruefung, setNurPruefung]   = useState(false);
  const [nurFalsch, setNurFalsch]       = useState(false);

  const [current, setCurrent]           = useState(null);
  const [selected, setSelected]         = useState(null);
  const [phase, setPhase]               = useState('question');
  const [sessionStats, setSessionStats] = useState({ correct: 0, incorrect: 0, streak: 0 });
  const [todayCount, setTodayCount]     = useState(0);
  const [streakCount, setStreakCount]   = useState(0);

  const roundSeenRef   = useRef(new Set());
  const notifPrefsRef  = useRef(DEFAULT_TIMES);

  function buildSelectionSig(mods, np, sel, nf) {
    const modKeys = Object.entries(mods).filter(([, v]) => v).map(([k]) => k).sort().join(',');
    return `${modKeys}|${np}|${sel.schriftlich}|${sel.kommission}|${nf}`;
  }

  // pick next question with unseen-first round-robin + fresh displayKey
  function pickNextQuestion(perf, mods, sel, qs, np = false, nf = false) {
    const p = filterQuestions(qs, mods, sel, np, nf, perf);
    if (!p.length) return null;
    const unseen = p.filter((q) => !roundSeenRef.current.has(q.id));
    if (unseen.length === 0) {
      roundSeenRef.current = new Set();
    }
    const selectFrom = unseen.length > 0 ? unseen : p;
    const q = weightedRandom(selectFrom, perf);
    return q ? { ...q, _displayKey: Math.random() } : null;
  }

  useEffect(() => {
    async function init() {
      const [perf, mods, fl, rep, sel, savedSize, daily, streak, goal, np, notifPrefs, nf, roundState] = await Promise.all([
        loadJSON(KEYS.PERFORMANCE, {}),
        loadJSON(KEYS.ACTIVE_MODULES, buildDefaultModules()),
        loadJSON(KEYS.FLAGGED, {}),
        loadJSON(KEYS.REPORTS, {}),
        loadJSON(KEYS.SELECTION, DEFAULT_SELECTION),
        loadJSON(KEYS.FONT_SIZE, 'medium'),
        loadJSON(KEYS.DAILY, { date: '', count: 0 }),
        checkStreakOnFocus(),
        loadJSON(KEYS.DAILY_GOAL, DEFAULT_DAILY_GOAL),
        loadJSON(KEYS.NUR_PRUEFUNG, false),
        loadJSON(KEYS.NOTIF_PREFS, DEFAULT_TIMES),
        loadJSON(KEYS.NUR_FALSCH, false),
        loadJSON(KEYS.ROUND_STATE, null),
      ]);

      const { result: migratedMods, changed } = migrateActiveModules(mods);
      if (changed) await saveJSON(KEYS.ACTIVE_MODULES, migratedMods);

      notifPrefsRef.current = Array.isArray(notifPrefs) ? notifPrefs : DEFAULT_TIMES;

      setPerformance(perf);
      setActiveModules(migratedMods);
      setFlagged(fl);
      setReports(rep);
      setSelection(sel);
      setFontSize(FONT_SIZES[savedSize] ?? FONT_SIZES.medium);
      setDailyGoal(goal);
      setNurPruefung(np);
      setNurFalsch(nf);
      const todayCountInit = daily.date === todayKey() ? daily.count : 0;
      setTodayCount(todayCountInit);
      setStreakCount(streak.count);

      const qs = loadAllQuestions().map((q) => ({ ...q, _flagged: fl[q.id] ?? false }));
      setQuestions(qs);

      // Restore round state if selection signature matches
      const sig = buildSelectionSig(migratedMods, np, sel, nf);
      if (roundState?.sig === sig && Array.isArray(roundState?.seenIds)) {
        roundSeenRef.current = new Set(roundState.seenIds);
        const restoredPool = filterQuestions(qs, migratedMods, sel, np, nf, perf);
        const savedQ = roundState.currentId
          ? restoredPool.find((q) => q.id === roundState.currentId)
          : null;
        setCurrent(savedQ
          ? { ...savedQ, _displayKey: Math.random() }
          : pickNextQuestion(perf, migratedMods, sel, qs, np, nf));
      } else {
        roundSeenRef.current = new Set();
        setCurrent(pickNextQuestion(perf, migratedMods, sel, qs, np, nf));
      }

      const remaining = Math.max(0, goal - todayCountInit);
      scheduleReminders(notifPrefsRef.current, remaining, goal).catch(() => {});
    }
    init();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useFocusEffect(
    useCallback(() => {
      async function refresh() {
        const [perf, mods, fl, rep, sel, savedSize, daily, streak, goal, np, notifPrefs, nf, roundState] = await Promise.all([
          loadJSON(KEYS.PERFORMANCE, {}),
          loadJSON(KEYS.ACTIVE_MODULES, buildDefaultModules()),
          loadJSON(KEYS.FLAGGED, {}),
          loadJSON(KEYS.REPORTS, {}),
          loadJSON(KEYS.SELECTION, DEFAULT_SELECTION),
          loadJSON(KEYS.FONT_SIZE, 'medium'),
          loadJSON(KEYS.DAILY, { date: '', count: 0 }),
          checkStreakOnFocus(),
          loadJSON(KEYS.DAILY_GOAL, DEFAULT_DAILY_GOAL),
          loadJSON(KEYS.NUR_PRUEFUNG, false),
          loadJSON(KEYS.NOTIF_PREFS, DEFAULT_TIMES),
          loadJSON(KEYS.NUR_FALSCH, false),
          loadJSON(KEYS.ROUND_STATE, null),
        ]);

        const { result: migratedMods } = migrateActiveModules(mods);
        notifPrefsRef.current = Array.isArray(notifPrefs) ? notifPrefs : DEFAULT_TIMES;
        setPerformance(perf);
        setActiveModules(migratedMods);
        setFlagged(fl);
        setReports(rep);
        setSelection(sel);
        setFontSize(FONT_SIZES[savedSize] ?? FONT_SIZES.medium);
        setDailyGoal(goal);
        setNurPruefung(np);
        setNurFalsch(nf);
        const todayCountRefresh = daily.date === todayKey() ? daily.count : 0;
        setTodayCount(todayCountRefresh);
        setStreakCount(streak.count);

        const qs = loadAllQuestions().map((q) => ({ ...q, _flagged: fl[q.id] ?? false }));
        setQuestions(qs);

        // Restore round state if signature matches, else fresh round
        const sig = buildSelectionSig(migratedMods, np, sel, nf);
        if (roundState?.sig === sig && Array.isArray(roundState?.seenIds)) {
          roundSeenRef.current = new Set(roundState.seenIds);
        } else {
          roundSeenRef.current = new Set();
        }

        // Keep current question if still valid in the (possibly updated) pool
        setCurrent((prev) => {
          if (!prev) return pickNextQuestion(perf, migratedMods, sel, qs, np, nf);
          const newPool = filterQuestions(qs, migratedMods, sel, np, nf, perf);
          return newPool.some((q) => q.id === prev.id)
            ? prev
            : pickNextQuestion(perf, migratedMods, sel, qs, np, nf);
        });

        const remaining = Math.max(0, goal - todayCountRefresh);
        scheduleReminders(notifPrefsRef.current, remaining, goal).catch(() => {});
      }
      refresh();
    }, [])
  );

  function buildDefaultModules() {
    return Object.fromEntries(modulesData.map((m) => [m.id, true]));
  }

  const pool = useMemo(
    () => filterQuestions(questions, activeModules, selection, nurPruefung, nurFalsch, performance),
    [questions, activeModules, selection, nurPruefung, nurFalsch, performance]
  );

  // Count wrong questions in base pool (for toggle label, regardless of nurFalsch)
  const falschCount = useMemo(
    () => filterQuestions(questions, activeModules, selection, nurPruefung, false, performance)
            .filter((q) => (performance[q.id]?.incorrect ?? 0) > 0).length,
    [questions, activeModules, selection, nurPruefung, performance]
  );

  async function handleAnswer(result) {
    if (phase !== 'question' || !current) return;

    let isCorrect = false;
    let isPartial = false;

    if (current.type === 'multiple_choice') {
      isCorrect = result === current.correct;
    } else if (current.type === 'multiple_choice_multi') {
      const correctSet = new Set(current.correct ?? []);
      const arr = Array.isArray(result) ? result : [];
      isCorrect = arr.length === correctSet.size && arr.every((i) => correctSet.has(i));
    } else {
      isCorrect = result === 'correct';
      isPartial = result === 'partial';
    }

    setSelected(result);
    setPhase('answer');

    const prev = performance[current.id] ?? { correct: 0, incorrect: 0 };
    const newPerf = {
      ...performance,
      [current.id]: {
        correct:   prev.correct   + (isCorrect ? 1 : isPartial ? 0.5 : 0),
        incorrect: prev.incorrect + (!isCorrect && !isPartial ? 1 : 0),
        attempts:  (prev.attempts ?? 0) + 1,
        lastSeen:  Date.now(),
      },
    };
    setPerformance(newPerf);
    await saveJSON(KEYS.PERFORMANCE, newPerf);
    // Persist current question so app restart resumes here
    const answerSig = buildSelectionSig(activeModules, nurPruefung, selection, nurFalsch);
    saveJSON(KEYS.ROUND_STATE, { seenIds: [...roundSeenRef.current], currentId: current.id, sig: answerSig }).catch(() => {});

    const daily    = await incrementDaily();
    const newCount = daily.count;
    setTodayCount(newCount);
    const remaining = Math.max(0, dailyGoal - newCount);
    scheduleReminders(notifPrefsRef.current, remaining, dailyGoal).catch(() => {});
    const newStreak = await updateStreak(newCount, dailyGoal);
    setStreakCount(newStreak.count);

    setSessionStats((prev) => ({
      correct:   prev.correct   + (isCorrect ? 1 : 0),
      incorrect: prev.incorrect + (!isCorrect && !isPartial ? 1 : 0),
      streak:    isCorrect ? prev.streak + 1 : 0,
    }));

    if (isCorrect) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } else if (!isPartial) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
    } else {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }
  }

  function handleNext() {
    if (current) roundSeenRef.current.add(current.id);
    const next = pickNextQuestion(performance, activeModules, selection, questions, nurPruefung, nurFalsch);
    const sig = buildSelectionSig(activeModules, nurPruefung, selection, nurFalsch);
    saveJSON(KEYS.ROUND_STATE, { seenIds: [...roundSeenRef.current], currentId: next?.id ?? null, sig }).catch(() => {});
    setCurrent(next);
    setSelected(null);
    setPhase('question');
  }

  async function handleFlag() {
    if (!current) return;
    const isFlagged = current._flagged;
    Alert.alert(
      isFlagged ? 'Markierung entfernen?' : 'Frage markieren',
      isFlagged ? 'Markierung entfernen?' : 'Diese Frage zur Wiederholung markieren?',
      [
        { text: 'Abbrechen', style: 'cancel' },
        {
          text: isFlagged ? 'Entfernen' : 'Markieren',
          onPress: async () => {
            const newFlagged = { ...flagged };
            if (isFlagged) {
              delete newFlagged[current.id];
            } else {
              newFlagged[current.id] = { flaggedAt: Date.now() };
            }
            setFlagged(newFlagged);
            await saveJSON(KEYS.FLAGGED, newFlagged);
            setCurrent((q) => ({ ...q, _flagged: !isFlagged }));
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
          },
        },
      ]
    );
  }

  async function handleReport() {
    if (!current) return;
    Alert.alert(
      'Frage melden',
      'Möchtest du diese Frage als fehlerhaft melden?',
      [
        { text: 'Abbrechen', style: 'cancel' },
        {
          text: 'Melden',
          onPress: async () => {
            const newReports = {
              ...reports,
              [current.id]: { reportedAt: Date.now(), comment: '', sent: false },
            };
            setReports(newReports);
            await saveJSON(KEYS.REPORTS, newReports);
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
            Alert.alert('Gemeldet', 'In den Einstellungen kannst du alle gemeldeten Fragen absenden.');
          },
        },
      ]
    );
  }

  async function toggleSelection(key) {
    const newSel = { ...selection, [key]: !selection[key] };
    if (!newSel.schriftlich && !newSel.kommission) return;
    setSelection(newSel);
    await saveJSON(KEYS.SELECTION, newSel);
    roundSeenRef.current = new Set();
    saveJSON(KEYS.ROUND_STATE, null).catch(() => {});
    setCurrent(pickNextQuestion(performance, activeModules, newSel, questions, nurPruefung, nurFalsch));
    setSelected(null);
    setPhase('question');
  }

  async function toggleNurFalsch() {
    const newNf = !nurFalsch;
    setNurFalsch(newNf);
    await saveJSON(KEYS.NUR_FALSCH, newNf);
    roundSeenRef.current = new Set();
    saveJSON(KEYS.ROUND_STATE, null).catch(() => {});
    setCurrent(pickNextQuestion(performance, activeModules, selection, questions, nurPruefung, newNf));
    setSelected(null);
    setPhase('question');
  }

  // D: session stats for display
  const sessionTotal = sessionStats.correct + sessionStats.incorrect;

  const isReported = current && !!reports[current?.id];
  const styles = makeStyles(colors);

  return (
    <View style={styles.container}>
      {/* D: stats row with Richtig/Falsch counter */}
      <View style={styles.statsRow}>
        <View style={styles.statItem}>
          <Text style={styles.statValue}>{pool.length}</Text>
          <Text style={styles.statLabel}>Fragen</Text>
        </View>
        <View style={styles.statItem}>
          <Text style={[styles.statValue, todayCount >= dailyGoal && { color: colors.correct }]}>
            {todayCount}
          </Text>
          <Text style={styles.statLabel}>Heute</Text>
        </View>
        {streakCount > 1 && (
          <View style={styles.statItem}>
            <Text style={[styles.statValue, { color: colors.partial }]}>🔥{streakCount}</Text>
            <Text style={styles.statLabel}>Streak</Text>
          </View>
        )}
        {sessionStats.streak > 1 && (
          <View style={styles.statItem}>
            <Text style={[styles.statValue, { color: colors.correct }]}>⚡{sessionStats.streak}</Text>
            <Text style={styles.statLabel}>Serie</Text>
          </View>
        )}
        {sessionTotal > 0 && (
          <View style={styles.statItem}>
            <Text style={[styles.statValue, { color: colors.correct }]}>✓{sessionStats.correct}</Text>
            <Text style={styles.statLabel}>Richtig</Text>
          </View>
        )}
      </View>

      <View style={styles.selectionSection}>
        <Text style={styles.selectionLabel}>Fragenauswahl</Text>
        <View style={styles.selectionRow}>
          <TouchableOpacity
            style={[styles.toggleBtn, selection.schriftlich && styles.toggleBtnActive]}
            onPress={() => toggleSelection('schriftlich')}
          >
            <Text style={[styles.toggleText, selection.schriftlich && styles.toggleTextActive]}>
              ✏️ Schriftlich
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.toggleBtn, selection.kommission && styles.toggleBtnCommission]}
            onPress={() => toggleSelection('kommission')}
          >
            <Text style={[styles.toggleText, selection.kommission && styles.toggleTextCommission]}>
              🎓 Kommission
            </Text>
          </TouchableOpacity>
        </View>
        <TouchableOpacity
          style={[styles.toggleBtn, styles.toggleBtnFalsch, nurFalsch && styles.toggleBtnFalschActive]}
          onPress={toggleNurFalsch}
        >
          <Text style={[styles.toggleText, nurFalsch && styles.toggleTextFalsch]}>
            {`✗ Nur falsch beantwortete${falschCount > 0 ? ` (${falschCount})` : ''}`}
          </Text>
        </TouchableOpacity>
      </View>

      <ScrollView style={styles.scroll} showsVerticalScrollIndicator={false}>
        {pool.length === 0 ? (
          <View style={styles.empty}>
            <Text style={styles.emptyTitle}>
              {nurFalsch ? 'Alles richtig! 💪' : 'Keine Fragen'}
            </Text>
            <Text style={styles.emptyText}>
              {nurFalsch
                ? 'Keine falsch beantworteten Fragen in der aktuellen Auswahl.'
                : !selection.schriftlich && !selection.kommission
                  ? 'Aktiviere mindestens eine Fragenauswahl.'
                  : 'Aktiviere Module unter „Module".'}
            </Text>
          </View>
        ) : current?.type === 'open' ? (
          <OpenQuestionCard
            question={current} phase={phase} performance={performance}
            onAnswer={handleAnswer} onFlag={handleFlag}
            onReport={handleReport} isReported={isReported} fontSize={fontSize}
          />
        ) : current?.type === 'multiple_choice_multi' ? (
          <MultiChoiceCard
            question={current} phase={phase} selected={selected} performance={performance}
            onAnswer={handleAnswer} onFlag={handleFlag}
            onReport={handleReport} isReported={isReported} fontSize={fontSize}
          />
        ) : (
          <QuestionCard
            question={current} selected={selected} phase={phase} performance={performance}
            onAnswer={handleAnswer} onFlag={handleFlag}
            onReport={handleReport} isReported={isReported} fontSize={fontSize}
          />
        )}

        {phase === 'answer' && pool.length > 0 && (
          <TouchableOpacity style={styles.nextBtn} onPress={handleNext}>
            <Text style={styles.nextBtnText}>Nächste Frage →</Text>
          </TouchableOpacity>
        )}
        <View style={{ height: 32 }} />
      </ScrollView>
    </View>
  );
}

function makeStyles(colors) {
  return StyleSheet.create({
    container: {
      flex: 1, backgroundColor: colors.bg,
      paddingHorizontal: 16, paddingTop: 12,
    },
    statsRow: {
      flexDirection: 'row', justifyContent: 'space-around',
      backgroundColor: colors.surface, borderRadius: 12,
      paddingVertical: 10, marginBottom: 10,
      borderWidth: 1, borderColor: colors.border,
    },
    statItem:  { alignItems: 'center' },
    statValue: { fontSize: 18, fontWeight: '700', color: colors.text },
    statLabel: { fontSize: 11, color: colors.textMuted, marginTop: 2 },
    selectionSection: { marginBottom: 12 },
    selectionLabel: {
      color: colors.textMuted, fontSize: 11, fontWeight: '700',
      textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: 6,
    },
    selectionRow: { flexDirection: 'row', gap: 8 },
    toggleBtn: {
      flex: 1, backgroundColor: colors.surface,
      borderRadius: 10, paddingVertical: 10, alignItems: 'center',
      borderWidth: 1, borderColor: colors.border,
    },
    toggleBtnActive:      { backgroundColor: colors.accentDim,     borderColor: colors.accent },
    toggleBtnCommission:  { backgroundColor: colors.commissionDim, borderColor: colors.commission },
    toggleBtnFalsch:      { marginTop: 8, flex: 0 },
    toggleBtnFalschActive:{ backgroundColor: colors.wrongDim, borderColor: colors.wrong },
    toggleText:           { color: colors.textMuted, fontWeight: '600', fontSize: 13 },
    toggleTextActive:     { color: colors.accent },
    toggleTextCommission: { color: colors.commission },
    toggleTextFalsch:     { color: colors.wrong },
    scroll: { flex: 1 },
    nextBtn: {
      backgroundColor: colors.surface, borderRadius: 12,
      padding: 16, alignItems: 'center',
      borderWidth: 1, borderColor: colors.border, marginTop: 4,
    },
    nextBtnText: { color: colors.text, fontWeight: '600', fontSize: 16 },
    empty: {
      backgroundColor: colors.surface, borderRadius: 16,
      padding: 28, alignItems: 'center',
      borderWidth: 1, borderColor: colors.border, marginTop: 20,
    },
    emptyTitle: { color: colors.text, fontSize: 18, fontWeight: '700', marginBottom: 10 },
    emptyText:  { color: colors.textSub, fontSize: 14, textAlign: 'center', lineHeight: 20 },
  });
}
