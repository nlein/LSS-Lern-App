import React, { useMemo } from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { useTheme } from '../lib/ThemeContext';
import { shuffleOptions, getModuleLabel } from '../lib/utils';

export default function QuestionCard({
  question, selected, phase, performance,
  onAnswer, onFlag, onReport, isReported, fontSize,
}) {
  if (!question) return null;

  const { colors } = useTheme();
  const styles = makeStyles(colors);
  const perf = performance[question.id];

  // B: shuffle once per display — _displayKey changes every time a question is shown
  // (even if it's the same question.id), ensuring fresh shuffles on repeated questions
  const { options, correct } = useMemo(
    () => shuffleOptions(question.options, question.correct),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [question._displayKey ?? question.id]
  );

  function optionStyle(idx) {
    if (phase !== 'answer') {
      return selected === idx ? styles.optionSelected : styles.option;
    }
    if (idx === correct) return styles.optionCorrect;
    if (idx === selected && idx !== correct) return styles.optionWrong;
    return styles.option;
  }

  function optionTextStyle(idx) {
    if (phase !== 'answer') return { color: selected === idx ? colors.accent : colors.text };
    if (idx === correct) return { color: colors.correct };
    if (idx === selected && idx !== correct) return { color: colors.wrong };
    return { color: colors.textMuted };
  }

  return (
    <View style={styles.card}>
      <View style={styles.cardHeader}>
        <Text style={[styles.moduleLabel, { fontSize: fontSize.label }]} numberOfLines={1}>
          {getModuleLabel(question.module)}
        </Text>
        {perf && (
          <Text style={[styles.perfLabel, { fontSize: fontSize.label }]}>
            ✓{perf.correct} ✗{perf.incorrect}
          </Text>
        )}
        <TouchableOpacity onPress={onFlag} hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}>
          <Text style={[styles.iconBtn, question._flagged && { color: colors.accent }]}>
            {question._flagged ? '🚩' : '⚐'}
          </Text>
        </TouchableOpacity>
        <TouchableOpacity onPress={onReport} hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}>
          <Text style={[styles.iconBtn, isReported && { color: colors.partial, opacity: 0.6 }]}>⚠</Text>
        </TouchableOpacity>
      </View>

      <Text style={[styles.questionText, { fontSize: fontSize.question }]}>{question.question}</Text>

      <View style={styles.options}>
        {options.map((opt, idx) => (
          <TouchableOpacity
            key={idx}
            style={optionStyle(idx)}
            onPress={() => phase === 'question' && onAnswer(idx)}
            activeOpacity={phase === 'question' ? 0.7 : 1}
          >
            <Text style={[styles.optionLabel, { fontSize: fontSize.option, color: colors.textMuted }]}>
              {String.fromCharCode(65 + idx)}
            </Text>
            <Text style={[styles.optionText, { fontSize: fontSize.option }, optionTextStyle(idx)]}>
              {opt}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {phase === 'answer' && question.explanation && (
        <View style={styles.explanation}>
          <Text style={[styles.explanationText, { fontSize: fontSize.body }]}>{question.explanation}</Text>
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
    moduleLabel: {
      color: colors.accent,
      fontWeight: '600',
      flex: 1,
    },
    perfLabel: {
      color: colors.textMuted,
    },
    iconBtn: {
      fontSize: 18,
      color: colors.textSub,
    },
    questionText: {
      color: colors.text,
      fontWeight: '600',
      lineHeight: 26,
      marginBottom: 18,
    },
    options: { gap: 8 },
    option: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      backgroundColor: colors.bg,
      borderRadius: 10,
      padding: 12,
      borderWidth: 1,
      borderColor: colors.border,
      gap: 10,
    },
    optionSelected: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      backgroundColor: colors.accentDim,
      borderRadius: 10,
      padding: 12,
      borderWidth: 1,
      borderColor: colors.accent,
      gap: 10,
    },
    optionCorrect: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      backgroundColor: colors.correctDim,
      borderRadius: 10,
      padding: 12,
      borderWidth: 1,
      borderColor: colors.correct,
      gap: 10,
    },
    optionWrong: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      backgroundColor: colors.wrongDim,
      borderRadius: 10,
      padding: 12,
      borderWidth: 1,
      borderColor: colors.wrong,
      gap: 10,
    },
    optionLabel: {
      fontWeight: '700',
      width: 18,
    },
    optionText: {
      flex: 1,
      lineHeight: 20,
    },
    explanation: {
      marginTop: 14,
      backgroundColor: colors.bg,
      borderRadius: 10,
      padding: 12,
      borderLeftWidth: 3,
      borderLeftColor: colors.accent,
    },
    explanationText: {
      color: colors.textSub,
      lineHeight: 20,
    },
  });
}
