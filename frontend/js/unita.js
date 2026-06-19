// Single source of truth for the units of measure proposed across the app
// (ingredient creation, recipe yield). Everywhere a unit is *chosen* by the user
// it must come from this list (shown as a dropdown); where a unit is *derived*
// (recipe rows) it is forced from the chosen ingredient/recipe.
//
// Add a unit here to make it available everywhere. This constant is the seam for
// a future feature that will let users add units from the UI (stored locally and
// merged on top of these defaults).
export const UNITA_MISURA = ['g', 'ml', 'pz', 'q.b.'];

// The proposed units, plus `valore` when it is a non-empty custom unit not in the
// list — so existing or imported data (e.g. an older "kg") is preserved when shown
// in a dropdown instead of being silently changed.
export function unitaConValore(valore) {
  const v = (valore || '').trim();
  return v && !UNITA_MISURA.includes(v) ? [...UNITA_MISURA, v] : [...UNITA_MISURA];
}
