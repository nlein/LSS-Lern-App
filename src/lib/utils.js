// Fisher-Yates shuffle of options; remaps correct index/indices accordingly.
// Returns:
//   options      — shuffled text array
//   correct      — new (shuffled) position of the correct answer
//   indices      — indices[shuffledPos] = originalPos  (shuffle → original)
//   toShuffled   — toShuffled[originalPos] = shuffledPos  (original → shuffle)
export function shuffleOptions(options, correct) {
  const n = options.length;
  const indices = Array.from({ length: n }, (_, i) => i);
  for (let j = n - 1; j > 0; j--) {
    const k = Math.floor(Math.random() * (j + 1));
    [indices[j], indices[k]] = [indices[k], indices[j]];
  }
  const shuffled = indices.map((i) => options[i]);
  // toShuffled: originalPos → shuffledPos
  const toShuffled = {};
  indices.forEach((originalPos, shuffledPos) => { toShuffled[originalPos] = shuffledPos; });

  if (Array.isArray(correct)) {
    return { options: shuffled, correct: correct.map((i) => toShuffled[i]), indices, toShuffled };
  }
  return { options: shuffled, correct: toShuffled[correct], indices, toShuffled };
}

// Returns the human-readable module name from modules.json
const _modulesData = require('../data/modules.json');
const _labelMap = Object.fromEntries(_modulesData.map((m) => [m.id, m.name]));
export function getModuleLabel(id) {
  return _labelMap[id] ?? id;
}
