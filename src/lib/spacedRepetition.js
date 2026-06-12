import modulesData from '../data/modules.json';

// Modules eligible for Kommissions-Fragen (open type)
const KOMMISSION_MODULE_SET = new Set(
  modulesData.filter((m) => m.format === 'schriftlich+kommission').map((m) => m.id)
);

export function calcWeight(perf) {
  if (!perf) return 10;
  return Math.max(1, 10 + perf.incorrect * 3 - perf.correct * 2);
}

export function calcWeightWithSource(perf) {
  if (!perf) return 10;
  return Math.max(1, 10 + perf.incorrect * 3 - perf.correct * 2);
}

export function weightedRandom(questions, performance) {
  if (!questions.length) return null;
  const weights = questions.map((q) => calcWeightWithSource(performance[q.id]));
  const total = weights.reduce((a, b) => a + b, 0);
  let r = Math.random() * total;
  for (let i = 0; i < questions.length; i++) {
    r -= weights[i];
    if (r <= 0) return questions[i];
  }
  return questions[questions.length - 1];
}

// selection = { schriftlich: bool, kommission: bool }
// nurPruefung = bool — when true, only questions with relevanz === 'pruefung'
export function filterQuestions(questions, activeModules, selection, nurPruefung = false) {
  return questions.filter((q) => {
    if (!activeModules[q.module]) return false;
    if (nurPruefung && q.relevanz !== 'pruefung') return false;
    const isMC = q.type === 'multiple_choice' || q.type === 'multiple_choice_multi';
    const isOpen = q.type === 'open';
    if (selection.schriftlich && isMC) return true;
    if (selection.kommission && isOpen && KOMMISSION_MODULE_SET.has(q.module)) return true;
    return false;
  });
}

export function calcModuleStats(questions, performance, moduleId) {
  const qs = questions.filter((q) => q.module === moduleId);
  if (!qs.length) return { total: 0, seen: 0, correct: 0, accuracy: 0 };
  const seen = qs.filter((q) => performance[q.id]);
  const correct = seen.filter((q) => (performance[q.id]?.correct || 0) > 0);
  const totalCorrect = qs.reduce((s, q) => s + (performance[q.id]?.correct || 0), 0);
  const totalAnswered = qs.reduce((s, q) => {
    const p = performance[q.id];
    if (!p) return s;
    return s + (p.attempts ?? (Math.round(p.correct || 0) + (p.incorrect || 0)));
  }, 0);
  return {
    total: qs.length,
    seen: seen.length,
    correct: correct.length,
    accuracy: totalAnswered > 0 ? Math.round((totalCorrect / totalAnswered) * 100) : 0,
  };
}

export function calcSessionStats(initial) {
  return initial ?? { correct: 0, incorrect: 0, streak: 0 };
}
