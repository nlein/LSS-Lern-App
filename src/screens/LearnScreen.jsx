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
  incrementDaily, updateStreak, todayKey,
} from '../lib/storage';
import { weightedRandom, filterQuestions } from '../lib/spacedRepetition';
import QuestionCard from '../components/QuestionCard';
import OpenQuestionCard from '../components/OpenQuestionCard';
import MultiChoiceCard from '../components/MultiChoiceCard';
import modulesData from '../data/modules.json';

const DEFAULT_SELECTION  = { schriftlich: true, kommission: true };
const DEFAULT_DAILY_GOAL = 20;

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

  const [current, setCurrent]           = useState(null);
  const [selected, setSelected]         = useState(null);
  const [phase, setPhase]               = useState('question');
  const [sessionStats, setSessionStats] = useState({ correct: 0, incorrect: 0, streak: 0 });
  const [todayCount, setTodayCount]     = useState(0);
  const [streakCount, setStreakCount]   = useState(0);

  // A: track which question IDs have been shown in the current round;
  // reset when all pool questions seen once, or when pool changes.
  const roundSeenRef = useRef(new Set());

  // A+B: pick next question with unseen-first round-robin + fresh displayKey
  function pickNextQuestion(perf, mods, sel, qs, np = false) {
    const p = filterQuestions(qs, mods, sel, np);
    if (!p.length) return null;
    const unseen = p.filter((q) => !roundSeenRef.current.has(q.id));
    if (unseen.length === 0) {
      // All seen once — start new round
      roundSeenRef.current = new Set();
    }
    const selectFrom = unseen.length > 0 ? unseen : p;
    const q = weightedRandom(selectFrom, perf);
    // B: attach a unique displayKey so cards re-shuffle even for the same question
    return q ? { ...q, _displayKey: Math.random() } : null;
  }

  useEffect(() => {
    async function init() {
      const [perf, mods, fl, rep, sel, savedSize, daily, streak, goal, np] = await Promise.all([
        loadJSON(KEYS.PERFORMANCE, {}),
        loadJSON(KEYS.ACTIVE_MODULES, buildDefaultModules()),
        loadJSON(KEYS.FLAGGED, {}),
        loadJSON(KEYS.REPORTS, {}),
        loadJSON(KEYS.SELECTION, DEFAULT_SELECTION),
        loadJSON(KEYS.FONT_SIZE, 'medium'),
        loadJSON(KEYS.DAILY, { date: '', count: 0 }),
        loadJSON(KEYS.STREAK, { count: 0, lastDate: '' }),
        loadJSON(KEYS.DAILY_GOAL, DEFAULT_DAILY_GOAL),
        loadJSON(KEYS.NUR_PRUEFUNG, false),
      ]);

      const { result: migratedMods, changed } = migrateActiveModules(mods);
      if (changed) await saveJSON(KEYS.ACTIVE_MODULES, migratedMods);

      setPerformance(perf);
      setActiveModules(migratedMods);
      setFlagged(fl);
      setReports(rep);
      setSelection(sel);
      setFontSize(FONT_SIZES[savedSize] ?? FONT_SIZES.medium);
      setDailyGoal(goal);
      setNurPruefung(np);
      setTodayCount(daily.date === todayKey() ? daily.count : 0);
      setStreakCount(streak.count);

      const qs = loadAllQuestions().map((q) => ({ ...q, _flagged: fl[q.id] ?? false }));
      setQuestions(qs);

      roundSeenRef.current = new Set();
      setCurrent(pickNextQuestion(perf, migratedMods, sel, qs, np));
    }
    init();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useFocusEffect(
    useCallback(() => {
      async function refresh() {
        const [perf, mods, fl, rep, sel, savedSize, daily, streak, goal, np] = await Promise.all([
          loadJSON(KEYS.PERFORMANCE, {}),
          loadJSON(KEYS.ACTIVE_MODULES, buildDefaultModules()),
          loadJSON(KEYS.FLAGGED, {}),
          loadJSON(KEYS.REPORTS, {}),
          loadJSON(KEYS.SELECTION, DEFAULT_SELECTION),
          loadJSON(KEYS.FONT_SIZE, 'medium'),
          loadJSON(KEYS.DAILY, { date: '', count: 0 }),
          loadJSON(KEYS.STREAK, { count: 0, lastDate: '' }),
          loadJSON(KEYS.DAILY_GOAL, DEFAULT_DAILY_GOAL),
          loadJSON(KEYS.NUR_PRUEFUNG, false),
        ]);

        const { result: migratedMods } = migrateActiveModules(mods);
        setPerformance(perf);
        setActiveModules(migratedMods);
        setFlagged(fl);
        setReports(rep);
        setSelection(sel);
        setFontSize(FONT_SIZES[savedSize] ?? FONT_SIZES.medium);
        setDailyGoal(goal);
        setNurPruefung(np);
        setTodayCount(daily.date === todayKey() ? daily.count : 0);
        setStreakCount(streak.count);

        const qs = loadAllQuestions().map((q) => ({ ...q, _flagged: fl[q.id] ?? false }));
        setQuestions(qs);

        // Reset round when coming back from other screens (pool may have changed)
        roundSeenRef.current = new Set();
      }
      refresh();
    }, [])
  );

  function buildDefaultModules() {
    return Object.fromEntries(modulesData.map((m) => [m.id, true]));
  }

  const pool = useMemo(
    () => filterQuestions(questions, activeModules, selection, nurPruefung),
    [questions, activeModules, selection, nurPruefung]
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
        lastSeen:  Date.now(),
      },
    };
    setPerformance(newPerf);
    await saveJSON(KEYS.PERFORMANCE, newPerf);

    const daily    = await incrementDaily();
    const newCount = daily.count;
    setTodayCount(newCount);
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

  // A: advance to next with round-robin unseen-first
  function handleNext() {
    // Mark current as seen in this round before picking next
    if (current) roundSeenRef.current.add(current.id);
    setCurrent(pickNextQuestion(performance, activeModules, selection, questions, nurPruefung));
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
    // A: pool changed — reset round
    roundSeenRef.current = new Set();
    setCurrent(pickNextQuestion(performance, activeModules, newSel, questions, nurPruefung));
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
        {sessionTotal > 0 && (
          <View style={styles.statItem}>
            <Text style={[styles.statValue, { color: colors.wrong }]}>✗{sessionStats.incorrect}</Text>
            <Text style={styles.statLabel}>Falsch</Text>
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
      </View>

      <ScrollView style={styles.scroll} showsVerticalScrollIndicator={false}>
        {pool.length === 0 ? (
          <View style={styles.empty}>
            <Text style={styles.emptyTitle}>Keine Fragen</Text>
            <Text style={styles.emptyText}>
              {!selection.schriftlich && !selection.kommission
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
    toggleBtnActive:     { backgroundColor: colors.accentDim,     borderColor: colors.accent },
    toggleBtnCommission: { backgroundColor: colors.commissionDim, borderColor: colors.commission },
    toggleText:           { color: colors.textMuted, fontWeight: '600', fontSize: 13 },
    toggleTextActive:     { color: colors.accent },
    toggleTextCommission: { color: colors.commission },
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
