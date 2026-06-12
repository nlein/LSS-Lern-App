import React, { useState, useCallback } from 'react';
import { View, Text, ScrollView, StyleSheet } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';

import { useTheme } from '../lib/ThemeContext';
import { loadJSON, KEYS, migrateActiveModules, todayKey } from '../lib/storage';
import { calcModuleStats } from '../lib/spacedRepetition';
import modulesData from '../data/modules.json';

function loadAllQuestions() {
  return require('../data/questions').all ?? [];
}

function getAccuracyColor(accuracy, seen, colors) {
  if (seen === 0) return colors.border;
  if (accuracy >= 80) return colors.correct;
  if (accuracy >= 50) return colors.partial;
  return colors.wrong;
}

export default function DashboardScreen() {
  const { colors } = useTheme();
  const [data, setData] = useState(null);

  useFocusEffect(
    useCallback(() => {
      async function load() {
        const [perf, mods, daily, streak, np] = await Promise.all([
          loadJSON(KEYS.PERFORMANCE, {}),
          loadJSON(KEYS.ACTIVE_MODULES, {}),
          loadJSON(KEYS.DAILY, { date: '', count: 0 }),
          loadJSON(KEYS.STREAK, { count: 0 }),
          loadJSON(KEYS.NUR_PRUEFUNG, false),
        ]);

        const { result: activeMods } = migrateActiveModules(mods);
        const questions  = loadAllQuestions();
        const today      = todayKey();
        const todayCount = daily.date === today ? daily.count : 0;

        const visibleModules = modulesData.filter((m) => {
          if (!activeMods[m.id]) return false;
          if (np && m.relevanz !== 'pruefung') return false;
          return true;
        });

        const moduleStats = visibleModules.map((mod) => ({
          ...mod,
          ...calcModuleStats(questions, perf, mod.id),
        }));

        const totalCorrect = visibleModules.reduce((sum, mod) =>
          sum + questions.filter((q) => q.module === mod.id).reduce(
            (s, q) => s + (perf[q.id]?.correct || 0), 0
          ), 0
        );
        const totalAnswered = visibleModules.reduce((sum, mod) =>
          sum + questions.filter((q) => q.module === mod.id).reduce((s, q) => {
            const p = perf[q.id];
            if (!p) return s;
            return s + (p.attempts ?? (Math.round(p.correct || 0) + (p.incorrect || 0)));
          }, 0), 0
        );
        const overallAccuracy = totalAnswered > 0
          ? Math.round((totalCorrect / totalAnswered) * 100) : 0;

        const seenModules = moduleStats.filter((m) => m.seen > 0);
        const weakest = [...seenModules].sort((a, b) => a.accuracy - b.accuracy).slice(0, 3);

        setData({
          moduleStats, totalAnswered, overallAccuracy,
          todayCount, streak: streak.count, weakest,
          hasModules: visibleModules.length > 0,
        });
      }
      load();
    }, [])
  );

  const styles = makeStyles(colors);

  if (!data) {
    return (
      <View style={[styles.container, { justifyContent: 'center', alignItems: 'center' }]}>
        <Text style={{ color: colors.textMuted }}>Lade…</Text>
      </View>
    );
  }

  const { moduleStats, totalAnswered, overallAccuracy, todayCount, streak, weakest, hasModules } = data;

  if (!hasModules) {
    return (
      <View style={[makeStyles(colors).container, { justifyContent: 'center', alignItems: 'center' }]}>
        <Text style={{ color: colors.textMuted, textAlign: 'center', paddingHorizontal: 32 }}>
          Keine aktiven Module.{'\n'}Gehe zu „Module", um Module zu aktivieren.
        </Text>
      </View>
    );
  }

  return (
    <ScrollView style={styles.container} showsVerticalScrollIndicator={false}>
      <View style={styles.tileRow}>
        <View style={styles.tile}>
          <Text style={styles.tileValue}>{totalAnswered}</Text>
          <Text style={styles.tileLabel}>Beantwortet</Text>
        </View>
        <View style={styles.tile}>
          <Text style={[styles.tileValue, { color: getAccuracyColor(overallAccuracy, totalAnswered, colors) }]}>
            {totalAnswered > 0 ? `${overallAccuracy}%` : '–'}
          </Text>
          <Text style={styles.tileLabel}>Genauigkeit</Text>
        </View>
        <View style={styles.tile}>
          <Text style={styles.tileValue}>{streak > 0 ? `${streak}🔥` : '–'}</Text>
          <Text style={styles.tileLabel}>Streak</Text>
        </View>
        <View style={styles.tile}>
          <Text style={styles.tileValue}>{todayCount}</Text>
          <Text style={styles.tileLabel}>Heute</Text>
        </View>
      </View>

      {weakest.length > 0 && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Schwächste Module</Text>
          {weakest.map((mod) => {
            const color = getAccuracyColor(mod.accuracy, mod.seen, colors);
            return (
              <View key={mod.id} style={[styles.moduleRow, { borderColor: colors.wrongDim }]}>
                <View style={styles.moduleInfo}>
                  <Text style={styles.moduleName} numberOfLines={1}>{mod.name}</Text>
                  <Text style={styles.moduleSub}>{mod.seen}/{mod.total} gesehen · {mod.accuracy}% korrekt</Text>
                  <View style={styles.barTrack}>
                    <View style={[styles.barFill, { width: `${mod.accuracy}%`, backgroundColor: color }]} />
                  </View>
                </View>
                <Text style={[styles.accuracyBadge, { color }]}>{mod.accuracy}%</Text>
              </View>
            );
          })}
        </View>
      )}

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Aktive Module</Text>
        {moduleStats.map((mod) => {
          const color = getAccuracyColor(mod.accuracy, mod.seen, colors);
          return (
            <View key={mod.id} style={styles.moduleRow}>
              <View style={styles.moduleInfo}>
                <Text style={styles.moduleName} numberOfLines={1}>{mod.name}</Text>
                <Text style={styles.moduleSub}>
                  {mod.seen > 0
                    ? `${mod.seen}/${mod.total} gesehen · ${mod.accuracy}% korrekt`
                    : `${mod.total} Fragen · noch nicht geübt`}
                </Text>
                {mod.seen > 0 && (
                  <View style={styles.barTrack}>
                    <View style={[styles.barFill, { width: `${mod.accuracy}%`, backgroundColor: color }]} />
                  </View>
                )}
              </View>
              {mod.seen > 0 && (
                <Text style={[styles.accuracyBadge, { color }]}>{mod.accuracy}%</Text>
              )}
            </View>
          );
        })}
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
    tileRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 24 },
    tile: {
      flex: 1, minWidth: '44%',
      backgroundColor: colors.surface, borderRadius: 12,
      padding: 14, borderWidth: 1, borderColor: colors.border, alignItems: 'center',
    },
    tileValue: { color: colors.text, fontSize: 22, fontWeight: '700', marginBottom: 4 },
    tileLabel: { color: colors.textMuted, fontSize: 11, textAlign: 'center' },
    section:   { marginBottom: 24 },
    sectionTitle: {
      color: colors.textMuted, fontSize: 12, fontWeight: '700',
      textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: 10,
    },
    moduleRow: {
      flexDirection: 'row', alignItems: 'center',
      backgroundColor: colors.surface, borderRadius: 12,
      padding: 14, marginBottom: 6,
      borderWidth: 1, borderColor: colors.border,
    },
    moduleInfo:    { flex: 1, marginRight: 12 },
    moduleName:    { color: colors.text, fontSize: 14, fontWeight: '600', marginBottom: 3 },
    moduleSub:     { color: colors.textMuted, fontSize: 12, marginBottom: 6 },
    accuracyBadge: { fontWeight: '700', fontSize: 15, minWidth: 40, textAlign: 'right' },
    barTrack:      { height: 4, backgroundColor: colors.border, borderRadius: 2, overflow: 'hidden' },
    barFill:       { height: '100%', borderRadius: 2 },
  });
}
