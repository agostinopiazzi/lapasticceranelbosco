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

// Default yield (`resa`) for a recipe when none is known, derived only from its
// ingredient rows (ricette-componibili spec). Used both by the v2→v3 migration
// and when saving a brand-new recipe, so the rule stays identical.
//   quantita = sum of the numeric `quantita` of the rows (null/q.b. ignored)
//   unita_misura = the most frequent non-empty unit among the rows
//                  (ties: first seen); falls back to "g" when none is present.
// Accepts both ingredient rows and sub-recipe rows: only `quantita`/`unita_misura`
// matter here, so the kind of reference is irrelevant.
export function calcolaResaPredefinita(righe) {
  const elenco = Array.isArray(righe) ? righe : [];

  let somma = 0;
  for (const riga of elenco) {
    const q = riga && riga.quantita;
    if (typeof q === 'number' && Number.isFinite(q)) somma += q;
  }

  // Pick the unit that appears most often; keep insertion order for ties.
  const conteggi = new Map();
  for (const riga of elenco) {
    const um = riga && typeof riga.unita_misura === 'string' ? riga.unita_misura.trim() : '';
    if (um) conteggi.set(um, (conteggi.get(um) || 0) + 1);
  }
  let unita = 'g';
  let max = 0;
  for (const [um, n] of conteggi) {
    if (n > max) {
      max = n;
      unita = um;
    }
  }

  return { quantita: arrotonda(somma), unita_misura: unita };
}
