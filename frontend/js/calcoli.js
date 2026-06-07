// Deterministic arithmetic for recipes (CLAUDE.md §6). NO AI.
// Shared rounding rule: used both when scaling portions while copying a recipe
// and (in future) by the recipe generator, so results stay consistent.

// Round a quantity to at most 2 decimals, dropping trailing zeros.
// e.g. 33.333… → 33.33, 100 → 100, 12.5 → 12.5
export function arrotonda(x) {
  return Math.round(x * 100) / 100;
}

// Scale a quantity from `porzioniBase` portions to `nuovePorzioni`:
//   nuova_quantita = quantita * nuovePorzioni / porzioniBase
// Returns the value unchanged when scaling is not possible (missing quantity,
// or base/target portions ≤ 0) — see CLAUDE.md spec edge cases.
export function scalaQuantita(quantita, porzioniBase, nuovePorzioni) {
  if (quantita == null) return quantita;
  if (!porzioniBase || porzioniBase <= 0) return quantita;
  if (!nuovePorzioni || nuovePorzioni <= 0) return quantita;
  return arrotonda((quantita * nuovePorzioni) / porzioniBase);
}
