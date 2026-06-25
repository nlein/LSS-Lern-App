import React, { useState, useCallback } from 'react';
import {
  View, Text, TouchableOpacity, ScrollView, StyleSheet, Switch, Alert
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';

import { useTheme } from '../lib/ThemeContext';
import { loadJSON, saveJSON, KEYS, migrateActiveModules } from '../lib/storage';
import { calcModuleStats } from '../lib/spacedRepetition';
import modulesData from '../data/modules.json';

function loadAllQuestions() {
  return require('../data/questions').all ?? [];
}

const GROUPS = [
  { id: 'lss',        label: 'Lean Six Sigma',  colorKey: 'accent'      },
  { id: 'pmi',        label: 'PMI',              colorKey: 'correct'     },
  { id: 'scrum',      label: 'Scrum',            colorKey: 'partial'     },
  { id: 'digi',       label: 'Digitalisierung',  colorKey: 'textSub'     },
  { id: 'vertiefung', label: 'Vertiefung',       colorKey: 'commission'  },
];

export default function ModulesScreen() {
  const { colors } = useTheme();

  const [activeModules, setActiveModules] = useState({});
  const [performance, setPerformance]     = useState({});
  const [questions, setQuestions]         = useState([]);
  const [nurPruefung, setNurPruefung]     = useState(false);

  useFocusEffect(
    useCallback(() => {
      async function load() {
        const stored = await loadJSON(KEYS.ACTIVE_MODULES, buildDefault());
        const { result: mods, changed } = migrateActiveModules(stored);
        if (changed) await saveJSON(KEYS.ACTIVE_MODULES, mods);

        const [perf, np] = await Promise.all([
          loadJSON(KEYS.PERFORMANCE, {}),
          loadJSON(KEYS.NUR_PRUEFUNG, false),
        ]);
        setActiveModules(mods);
        setPerformance(perf);
        setQuestions(loadAllQuestions());
        setNurPruefung(np);
      }
      load();
    }, [])
  );

  function buildDefault() {
    return Object.fromEntries(modulesData.map((m) => [m.id, m.relevanz === 'pruefung']));
  }

  async function toggleModule(id) {
    const active = Object.values(activeModules).filter(Boolean);
    if (activeModules[id] && active.length === 1) return;
    const updated = { ...activeModules, [id]: !activeModules[id] };
    setActiveModules(updated);
    await saveJSON(KEYS.ACTIVE_MODULES, updated);
  }

  async function toggleGroup(groupId, value) {
    const groupModules = modulesData.filter((m) => m.group === groupId).map((m) => m.id);
    const updated = { ...activeModules };
    if (!value) {
      const otherActive = Object.entries(updated).filter(([id, on]) => on && !groupModules.includes(id));
      if (otherActive.length === 0) return;
    }
    for (const id of groupModules) updated[id] = value;
    setActiveModules(updated);
    await saveJSON(KEYS.ACTIVE_MODULES, updated);
  }

  async function handleNurPruefung(val) {
    setNurPruefung(val);
    await saveJSON(KEYS.NUR_PRUEFUNG, val);
  }

  async function applyStandardPreset() {
    const preset = Object.fromEntries(modulesData.map((m) => [m.id, m.relevanz === 'pruefung']));
    setActiveModules(preset);
    await saveJSON(KEYS.ACTIVE_MODULES, preset);
    // Invalidate round state so LearnScreen starts fresh
    await saveJSON(KEYS.ROUND_STATE, null);
  }

  async function confirmResetModule(mod) {
    Alert.alert(
      'Modul zurücksetzen',
      `Fortschritt für „${mod.name}" zurücksetzen? Alle richtig/falsch-Daten dieses Moduls werden gelöscht.`,
      [
        { text: 'Abbrechen', style: 'cancel' },
        {
          text: 'Zurücksetzen', style: 'destructive',
          onPress: async () => {
            const modQIds = new Set(questions.filter((q) => q.module === mod.id).map((q) => q.id));
            const newPerf = { ...performance };
            modQIds.forEach((id) => delete newPerf[id]);
            setPerformance(newPerf);
            await saveJSON(KEYS.PERFORMANCE, newPerf);
            // Remove module IDs from round state
            const roundState = await loadJSON(KEYS.ROUND_STATE, null);
            if (roundState?.seenIds) {
              const cleaned = roundState.seenIds.filter((id) => !modQIds.has(id));
              await saveJSON(KEYS.ROUND_STATE, { ...roundState, seenIds: cleaned });
            }
          },
        },
      ]
    );
  }

  function isGroupActive(groupId) {
    return modulesData.filter((m) => m.group === groupId).every((m) => activeModules[m.id]);
  }

  const visibleModules = modulesData;

  const styles = makeStyles(colors);

  return (
    <ScrollView style={styles.container} showsVerticalScrollIndicator={false}>
      {/* Nur-Mitschrift-Kernstoff Toggle */}
      <View style={styles.filterRow}>
        <Text style={styles.filterLabel}>Nur Mitschrift-Kernstoff</Text>
        <Switch
          value={nurPruefung}
          onValueChange={handleNurPruefung}
          trackColor={{ false: colors.border, true: colors.accent + '66' }}
          thumbColor={nurPruefung ? colors.accent : colors.textMuted}
        />
      </View>

      {/* Standard-Prüfung Preset */}
      <TouchableOpacity style={styles.presetBtn} onPress={applyStandardPreset}>
        <Text style={styles.presetBtnText}>📋 Standard-Prüfung (LSS BB · PMI · Scrum · Digi)</Text>
      </TouchableOpacity>

      {GROUPS.map((group) => {
        const groupModules = visibleModules.filter((m) => m.group === group.id);
        if (!groupModules.length) return null;
        const groupColor = colors[group.colorKey];
        const allOn = isGroupActive(group.id);

        return (
          <View key={group.id} style={styles.group}>
            <View style={styles.groupHeader}>
              <Text style={[styles.groupTitle, { color: groupColor }]}>{group.label}</Text>
              <TouchableOpacity
                style={[styles.groupToggle, allOn && { backgroundColor: groupColor + '22', borderColor: groupColor }]}
                onPress={() => toggleGroup(group.id, !allOn)}
              >
                <Text style={[styles.groupToggleText, { color: allOn ? groupColor : colors.textMuted }]}>
                  {allOn ? 'Alle an' : 'Alle aus'}
                </Text>
              </TouchableOpacity>
            </View>

            {groupModules.map((mod) => {
              const stats = calcModuleStats(questions, performance, mod.id);
              const isOn  = activeModules[mod.id] ?? true;
              const progress = stats.total > 0 ? stats.seen / stats.total : 0;

              return (
                <TouchableOpacity
                  key={mod.id}
                  style={[styles.moduleRow, !isOn && styles.moduleRowOff]}
                  onPress={() => toggleModule(mod.id)}
                  activeOpacity={0.7}
                >
                  <View style={styles.moduleInfo}>
                    <View style={styles.moduleTitleRow}>
                      <Text style={[styles.moduleName, !isOn && styles.moduleNameOff]} numberOfLines={1}>
                        {mod.name}
                      </Text>
                      {mod.relevanz === 'pruefung' && (
                        <View style={[styles.commBadge, { backgroundColor: colors.accentDim }]}>
                          <Text style={[styles.commBadgeText, { color: colors.accent }]}>S</Text>
                        </View>
                      )}
                      {mod.format === 'schriftlich+kommission' && (
                        <View style={styles.commBadge}>
                          <Text style={styles.commBadgeText}>K</Text>
                        </View>
                      )}
                      {mod.relevanz === 'vertiefung' && (
                        <View style={[styles.commBadge, { backgroundColor: colors.surfaceHigh }]}>
                          <Text style={[styles.commBadgeText, { color: colors.textMuted }]}>V</Text>
                        </View>
                      )}
                    </View>
                    <View style={styles.moduleSubRow}>
                      <Text style={styles.moduleSub}>
                        {stats.total > 0
                          ? `${stats.seen}/${stats.total} gesehen${stats.total > 0 && stats.accuracy > 0 ? ` · ${stats.accuracy}% korrekt` : ''}`
                          : 'Noch keine Fragen'}
                      </Text>
                    </View>
                    {stats.total > 0 && (
                      <View style={styles.progressBar}>
                        <View style={[styles.progressFill, { width: `${Math.round(progress * 100)}%`, backgroundColor: groupColor }]} />
                      </View>
                    )}
                  </View>
                  <TouchableOpacity
                    onPress={() => confirmResetModule(mod)}
                    hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
                    style={styles.resetBtn}
                  >
                    <Text style={styles.resetBtnText}>↺</Text>
                  </TouchableOpacity>
                  <Switch
                    value={isOn}
                    onValueChange={() => toggleModule(mod.id)}
                    trackColor={{ false: colors.border, true: groupColor + '66' }}
                    thumbColor={isOn ? groupColor : colors.textMuted}
                    ios_backgroundColor={colors.border}
                  />
                </TouchableOpacity>
              );
            })}
          </View>
        );
      })}
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
    filterRow: {
      flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
      backgroundColor: colors.surface, borderRadius: 12,
      padding: 14, marginBottom: 10,
      borderWidth: 1, borderColor: colors.border,
    },
    filterLabel: { color: colors.text, fontWeight: '600', fontSize: 15 },
    presetBtn: {
      backgroundColor: colors.surface, borderRadius: 12,
      padding: 13, marginBottom: 16, alignItems: 'center',
      borderWidth: 1, borderColor: colors.accent,
    },
    presetBtnText: { color: colors.accent, fontWeight: '600', fontSize: 13 },
    resetBtn: { paddingHorizontal: 8, paddingVertical: 4 },
    resetBtnText: { color: colors.textMuted, fontSize: 18 },
    group: { marginBottom: 20 },
    groupHeader: {
      flexDirection: 'row', alignItems: 'center',
      justifyContent: 'space-between', marginBottom: 8,
    },
    groupTitle: {
      fontSize: 13, fontWeight: '700',
      textTransform: 'uppercase', letterSpacing: 0.8,
    },
    groupToggle: {
      borderWidth: 1, borderColor: colors.border,
      borderRadius: 6, paddingHorizontal: 10, paddingVertical: 4,
    },
    groupToggleText: { fontSize: 12, fontWeight: '600' },
    moduleRow: {
      flexDirection: 'row', alignItems: 'center',
      backgroundColor: colors.surface, borderRadius: 12,
      padding: 14, marginBottom: 6,
      borderWidth: 1, borderColor: colors.border,
    },
    moduleRowOff: { opacity: 0.45 },
    moduleInfo:   { flex: 1, marginRight: 12 },
    moduleTitleRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 3 },
    moduleName:    { color: colors.text, fontSize: 14, fontWeight: '600', flex: 1 },
    moduleNameOff: { color: colors.textMuted },
    commBadge: {
      backgroundColor: colors.commissionDim, borderRadius: 4,
      width: 18, height: 18, alignItems: 'center', justifyContent: 'center',
    },
    commBadgeText: { color: colors.commission, fontSize: 10, fontWeight: '800' },
    moduleSubRow: { marginBottom: 6 },
    moduleSub:    { color: colors.textMuted, fontSize: 12 },
    progressBar:  { height: 3, backgroundColor: colors.border, borderRadius: 2, overflow: 'hidden' },
    progressFill: { height: '100%', borderRadius: 2 },
  });
}
