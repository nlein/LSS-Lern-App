// Fisher-Yates shuffle of options; remaps correct index/indices accordingly
export function shuffleOptions(options, correct) {
  const n = options.length;
  const indices = Array.from({ length: n }, (_, i) => i);
  for (let j = n - 1; j > 0; j--) {
    const k = Math.floor(Math.random() * (j + 1));
    [indices[j], indices[k]] = [indices[k], indices[j]];
  }
  const shuffled = indices.map((i) => options[i]);
  // oldIdx → newIdx mapping
  const newPos = {};
  indices.forEach((oldIdx, newIdx) => { newPos[oldIdx] = newIdx; });

  if (Array.isArray(correct)) {
    return { options: shuffled, correct: correct.map((i) => newPos[i]) };
  }
  return { options: shuffled, correct: newPos[correct] };
}

// Returns the human-readable module name from modules.json
const _modulesData = require('../data/modules.json');
const _labelMap = Object.fromEntries(_modulesData.map((m) => [m.id, m.name]));
export function getModuleLabel(id) {
  return _labelMap[id] ?? id;
}
