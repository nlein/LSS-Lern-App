import React, { useState, useEffect, useMemo } from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { useTheme } from '../lib/ThemeContext';
import { shuffleOptions, getModuleLabel } from '../lib/utils';

export default function MultiChoiceCard({
  question, phase, selected, performance,
  onAnswer, onFlag, onReport, isReported, fontSize,
}) {
  if (!question) return null;

  const { colors } = useTheme();
  const styles = makeStyles(colors);
  const perf = performance[question.id];

  // B: shuffle once per display — _displayKey changes every time a question is shown
  // indices[shuffledPos] = originalPos; toShuffled[originalPos] = shuffledPos
  const { options, correct: shuffledCorrect, indices, toShuffled } = useMemo(
    () => shuffleOptions(question.options, question.correct ?? []),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [question._displayKey ?? question.id]
  );
  const correctSet = useMemo(() => new Set(shuffledCorrect), [shuffledCorrect]);

  // Local picked state (uses shuffled indices for display)
  const [picked, setPicked] = useState([]);
  useEffect(() => { setPicked([]); }, [question.id]);

  function toggleOption(idx) {
    if (phase !== 'question') return;
    setPicked((prev) =>
      prev.includes(idx) ? prev.filter((i) => i !== idx) : [...prev, idx]
    );
  }

  function handleConfirm() {
    if (phase !== 'question') return;
    // pass original-space indices so handleAnswer can compare against question.correct
    onAnswer(picked.map((i) => indices[i]));
  }

  // selected (from parent) is in original-index space; convert to shuffled for display
  function pickedSetAfterAnswer() {
    return new Set((selected ?? []).map((origIdx) => toShuffled[origIdx]));
  }

  function optionStyle(idx) {
    if (phase === 'question') {
      return picked.includes(idx) ? styles.optionSelected : styles.option;
    }
    const ps = pickedSetAfterAnswer();
    if (correctSet.has(idx)) return styles.optionCorrect;
    if (ps.has(idx) && !correctSet.has(idx)) return styles.optionWrong;
    return styles.option;
  }

  function optionTextColor(idx) {
    if (phase === 'question') {
      return picked.includes(idx) ? colors.accent : colors.text;
    }
    const ps = pickedSetAfterAnswer();
    if (correctSet.has(idx)) return colors.correct;
    if (ps.has(idx)) return colors.wrong;
    return colors.textMuted;
  }

  function checkboxIcon(idx) {
    if (phase === 'question') return picked.includes(idx) ? '☑' : '☐';
    const ps = pickedSetAfterAnswer();
    if (correctSet.has(idx)) return '✓';
    if (ps.has(idx)) return '✗';
    return '☐';
  }

  // selected is original-space; compare against question.correct (also original-space)
  const origCorrectSet = useMemo(() => new Set(question.correct ?? []), [question.correct]);
  const isCorrect =
    phase === 'answer' &&
    selected != null &&
    selected.length === origCorrectSet.size &&
    selected.every((i) => origCorrectSet.has(i));

  return (
    <View style={styles.card}>
      <View style={styles.cardHeader}>
        <Text style={[styles.moduleLabel, { fontSize: fontSize?.label ?? 12 }]} numberOfLines={1}>
          {getModuleLabel(question.module)}
        </Text>
        {perf && (
          <Text style={[styles.perfLabel, { fontSize: fontSize?.label ?? 12 }]}>
            ✓{perf.correct} ✗{perf.incorrect}
          </Text>
        )}
        <Text style={[styles.multiTag, { fontSize: fontSize?.label ?? 12 }]}>Mehrfach</Text>
        <TouchableOpacity onPress={onFlag} hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}>
          <Text style={[styles.iconBtn, question._flagged && { color: colors.accent }]}>
            {question._flagged ? '🚩' : '⚐'}
          </Text>
        </TouchableOpacity>
        <TouchableOpacity onPress={onReport} hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}>
          <Text style={[styles.iconBtn, isReported && { color: colors.partial, opacity: 0.6 }]}>⚠</Text>
        </TouchableOpacity>
      </View>

      <Text style={[styles.questionText, { fontSize: fontSize?.question ?? 16 }]}>
        {question.question}
      </Text>
      <Text style={[styles.hint, { fontSize: fontSize?.label ?? 12 }]}>
        Mehrere Antworten möglich
      </Text>

      <View style={styles.options}>
        {options.map((opt, idx) => (
          <TouchableOpacity
            key={idx}
            style={optionStyle(idx)}
            onPress={() => toggleOption(idx)}
            activeOpacity={phase === 'question' ? 0.7 : 1}
          >
            <Text style={[styles.checkboxIcon, { fontSize: fontSize?.option ?? 14, color: optionTextColor(idx) }]}>
              {checkboxIcon(idx)}
            </Text>
            <Text style={[styles.optionText, { fontSize: fontSize?.option ?? 14, color: optionTextColor(idx) }]}>
              {opt}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {phase === 'question' && (
        <TouchableOpacity
          style={[styles.confirmBtn, picked.length === 0 && styles.confirmBtnDisabled]}
          onPress={handleConfirm}
          disabled={picked.length === 0}
        >
          <Text style={styles.confirmBtnText}>
            {picked.length === 0
              ? 'Mindestens eine Antwort wählen'
              : `Antwort prüfen (${picked.length} gewählt)`}
          </Text>
        </TouchableOpacity>
      )}

      {phase === 'answer' && (
        <View style={[styles.resultBanner, isCorrect ? styles.resultCorrect : styles.resultWrong]}>
          <Text style={[styles.resultText, { fontSize: fontSize?.body ?? 14 }]}>
            {isCorrect
              ? '✓ Alle richtigen Antworten gewählt!'
              : `✗ Richtig wären: ${shuffledCorrect.map((i) => String.fromCharCode(65 + i)).join(', ')}`}
          </Text>
        </View>
      )}

      {phase === 'answer' && question.explanation && (
        <View style={styles.explanation}>
          <Text style={[styles.explanationText, { fontSize: fontSize?.body ?? 13 }]}>
            {question.explanation}
          </Text>
        </View>
      )}
    </View>
  );
}

function makeStyles(colors) {
  return StyleSheet.create({
    card: {
      backgroundColor: colors.surface,
      borderRadius: 16,
      padding: 20,
      marginBottom: 12,
      borderWidth: 1,
      borderColor: colors.border,
    },
    cardHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      marginBottom: 14,
      gap: 8,
    },
    moduleLabel: { color: colors.accent, fontWeight: '600', flex: 1 },
    perfLabel:   { color: colors.textMuted },
    multiTag: {
      color: colors.textMuted,
      backgroundColor: colors.bg,
      borderRadius: 4,
      paddingHorizontal: 6,
      paddingVertical: 2,
      borderWidth: 1,
      borderColor: colors.border,
    },
    iconBtn: { fontSize: 18, color: colors.textSub },
    questionText: {
      color: colors.text,
      fontWeight: '600',
      lineHeight: 26,
      marginBottom: 6,
    },
    hint: { color: colors.textMuted, fontStyle: 'italic', marginBottom: 14 },
    options: { gap: 8 },
    option: {
      flexDirection: 'row', alignItems: 'flex-start',
      backgroundColor: colors.bg, borderRadius: 10, padding: 12,
      borderWidth: 1, borderColor: colors.border, gap: 10,
    },
    optionSelected: {
      flexDirection: 'row', alignItems: 'flex-start',
      backgroundColor: colors.accentDim, borderRadius: 10, padding: 12,
      borderWidth: 1, borderColor: colors.accent, gap: 10,
    },
    optionCorrect: {
      flexDirection: 'row', alignItems: 'flex-start',
      backgroundColor: colors.correctDim, borderRadius: 10, padding: 12,
      borderWidth: 1, borderColor: colors.correct, gap: 10,
    },
    optionWrong: {
      flexDirection: 'row', alignItems: 'flex-start',
      backgroundColor: colors.wrongDim, borderRadius: 10, padding: 12,
      borderWidth: 1, borderColor: colors.wrong, gap: 10,
    },
    checkboxIcon: { width: 22, fontWeight: '700' },
    optionText: { flex: 1, lineHeight: 20 },
    confirmBtn: {
      marginTop: 14, backgroundColor: colors.accent,
      borderRadius: 10, padding: 14, alignItems: 'center',
    },
    confirmBtnDisabled: { backgroundColor: colors.border },
    confirmBtnText: { color: '#fff', fontWeight: '600', fontSize: 14 },
    resultBanner: { marginTop: 14, borderRadius: 10, padding: 12 },
    resultCorrect: { backgroundColor: colors.correctDim, borderWidth: 1, borderColor: colors.correct },
    resultWrong:   { backgroundColor: colors.wrongDim,   borderWidth: 1, borderColor: colors.wrong },
    resultText:    { fontWeight: '600', color: colors.text },
    explanation: {
      marginTop: 14, backgroundColor: colors.bg,
      borderRadius: 10, padding: 12,
      borderLeftWidth: 3, borderLeftColor: colors.accent,
    },
    explanationText: { color: colors.textSub, lineHeight: 20 },
  });
}
