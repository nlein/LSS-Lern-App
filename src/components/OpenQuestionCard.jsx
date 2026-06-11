import React, { useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { useTheme } from '../lib/ThemeContext';
import { getModuleLabel } from '../lib/utils';

export default function OpenQuestionCard({
  question, phase, performance,
  onAnswer, onFlag, onReport, isReported, fontSize,
}) {
  if (!question) return null;

  const { colors } = useTheme();
  const styles = makeStyles(colors);
  const [revealed, setReveal] = useState(false);
  const perf = performance[question.id];

  function handleSelf(result) {
    onAnswer(result);
    setReveal(false);
  }

  return (
    <View style={styles.card}>
      <View style={styles.cardHeader}>
        <View style={styles.badges}>
          <Text style={[styles.moduleLabel, { fontSize: fontSize.label }]} numberOfLines={1}>
            {getModuleLabel(question.module)}
          </Text>
          <View style={styles.badge}>
            <Text style={[styles.badgeText, { fontSize: fontSize.label - 1 }]}>Kommission</Text>
          </View>
        </View>
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

      {question.stichworte?.length > 0 && (
        <View style={styles.keywords}>
          {question.stichworte.map((kw, i) => (
            <View key={i} style={styles.keyword}>
              <Text style={[styles.keywordText, { fontSize: fontSize.label }]}>{kw}</Text>
            </View>
          ))}
        </View>
      )}

      {!revealed && phase === 'question' && (
        <TouchableOpacity style={styles.revealBtn} onPress={() => setReveal(true)}>
          <Text style={[styles.revealText, { fontSize: fontSize.body }]}>Musterantwort anzeigen</Text>
        </TouchableOpacity>
      )}

      {revealed && (
        <>
          <View style={styles.musterantwort}>
            <Text style={[styles.musterLabel, { fontSize: fontSize.label }]}>Musterantwort</Text>
            <Text style={[styles.musterText, { fontSize: fontSize.body }]}>{question.musterantwort}</Text>
          </View>

          {phase === 'question' && (
            <View style={styles.selfAssess}>
              <Text style={[styles.selfLabel, { fontSize: fontSize.label }]}>Selbstbewertung:</Text>
              <View style={styles.selfButtons}>
                <TouchableOpacity style={[styles.selfBtn, styles.selfCorrect]} onPress={() => handleSelf('correct')}>
                  <Text style={[styles.selfBtnText, { fontSize: fontSize.body }]}>Konnte ich</Text>
                </TouchableOpacity>
                <TouchableOpacity style={[styles.selfBtn, styles.selfPartial]} onPress={() => handleSelf('partial')}>
                  <Text style={[styles.selfBtnText, { fontSize: fontSize.body }]}>Teilweise</Text>
                </TouchableOpacity>
                <TouchableOpacity style={[styles.selfBtn, styles.selfWrong]} onPress={() => handleSelf('wrong')}>
                  <Text style={[styles.selfBtnText, { fontSize: fontSize.body }]}>Konnte ich nicht</Text>
                </TouchableOpacity>
              </View>
            </View>
          )}
        </>
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
      borderColor: colors.commissionDim,
    },
    cardHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      marginBottom: 14,
      gap: 8,
    },
    badges: { flexDirection: 'row', alignItems: 'center', flex: 1, gap: 6 },
    moduleLabel: { color: colors.commission, fontWeight: '600' },
    badge: {
      backgroundColor: colors.commissionDim,
      borderRadius: 4,
      paddingHorizontal: 6,
      paddingVertical: 2,
    },
    badgeText: { color: colors.commission, fontWeight: '600' },
    perfLabel: { color: colors.textMuted },
    iconBtn: { fontSize: 18, color: colors.textSub },
    questionText: {
      color: colors.text,
      fontWeight: '600',
      lineHeight: 26,
      marginBottom: 14,
    },
    keywords: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginBottom: 14 },
    keyword: {
      backgroundColor: colors.bg,
      borderRadius: 6,
      paddingHorizontal: 8,
      paddingVertical: 3,
      borderWidth: 1,
      borderColor: colors.border,
    },
    keywordText: { color: colors.textSub },
    revealBtn: {
      backgroundColor: colors.commissionDim,
      borderRadius: 10,
      padding: 14,
      alignItems: 'center',
      borderWidth: 1,
      borderColor: colors.commission,
    },
    revealText: { color: colors.commission, fontWeight: '600' },
    musterantwort: {
      backgroundColor: colors.bg,
      borderRadius: 10,
      padding: 14,
      marginBottom: 14,
      borderLeftWidth: 3,
      borderLeftColor: colors.commission,
    },
    musterLabel: {
      color: colors.commission,
      fontWeight: '700',
      marginBottom: 6,
      textTransform: 'uppercase',
      letterSpacing: 0.5,
    },
    musterText: { color: colors.text, lineHeight: 22 },
    selfAssess: { gap: 8 },
    selfLabel: { color: colors.textSub, fontWeight: '600' },
    selfButtons: { flexDirection: 'row', gap: 8 },
    selfBtn: { flex: 1, borderRadius: 8, padding: 10, alignItems: 'center', borderWidth: 1 },
    selfCorrect: { backgroundColor: colors.correctDim, borderColor: colors.correct },
    selfPartial: { backgroundColor: colors.partialDim, borderColor: colors.partial },
    selfWrong:   { backgroundColor: colors.wrongDim,   borderColor: colors.wrong },
    selfBtnText: { color: colors.text, fontWeight: '600' },
  });
}
